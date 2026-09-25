-- ============================================================
-- 130 Dev log: a fast admin-wide activity feed, and more actions recorded
-- ============================================================
-- The admin "Dev log" (/admin/activity) reads public.activity_events newest
-- first across everything. Until now that table was only ever read per
-- person, per page or per booking, so it has no index for a global feed, and
-- only booking status changes plus about ten admin actions were written to
-- it. This migration:
--
--   1. adds the indexes the feed and its filters need (keyset pagination on
--      created_at + id, the actor filter, the event-type prefix filter);
--   2. records accounts, identity, Rental Pages, listings, team changes and
--      reviews with database triggers, so every code path is covered,
--      including direct edits and admin tools, not just the routes that
--      remembered to call logEvent();
--   3. makes every recorder SECURITY DEFINER and failure-proof.
--
-- Point 3 is the load-bearing one. Migration 065 revoked INSERT on
-- activity_events from signed-in users so nobody could forge an audit row.
-- A trigger runs with the privileges of whoever made the change, so a
-- recorder that is NOT security definer fails the moment a signed-in user
-- edits their own profile or page directly, and that failure would abort
-- the user's own save. The recorders below run as the table owner, and the
-- single insert they share catches its own errors: a log row that cannot be
-- written is skipped with a warning, never allowed to block the action it
-- describes. The existing booking recorder gets the same treatment.
--
-- Who did it: auth.uid() when the change came from a signed-in session;
-- otherwise the person the row itself names (the page owner on creation,
-- whoever confirmed a listing's authority, the reviewer, the person who sent
-- a team invitation); otherwise "system" (server jobs, webhooks).
-- No phone numbers, ID numbers, plates or document links are written into
-- metadata: the log names what changed, not the private values.
-- ============================================================

-- ─── 1. Indexes for the feed ────────────────────────────────
create index if not exists idx_activity_created
  on public.activity_events (created_at desc, id desc);

create index if not exists idx_activity_actor
  on public.activity_events (actor_id, created_at desc)
  where actor_id is not null;

create index if not exists idx_activity_role
  on public.activity_events (actor_role, created_at desc);

-- Category filter is a prefix match on event_type ("booking.%").
create index if not exists idx_activity_event_type
  on public.activity_events (event_type text_pattern_ops, created_at desc);

-- ─── 2. One shared, failure-proof writer ────────────────────
create or replace function public.dev_log_event(
  p_actor        uuid,
  p_event        text,
  p_subject_kind text,
  p_subject_id   uuid,
  p_renter       uuid,
  p_agency       uuid,
  p_booking      uuid,
  p_meta         jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_role  text;
begin
  if v_actor is not null then
    select role::text into v_role from public.profiles where id = v_actor;
  end if;

  insert into public.activity_events (
    actor_id, actor_role, event_type, subject_kind, subject_id,
    related_renter_id, related_agency_id, related_booking_id, metadata
  ) values (
    -- actor_id references profiles; an id with no profile row is recorded
    -- as the system rather than failing the foreign key.
    case when v_role is null then null else v_actor end,
    case when v_role in ('renter', 'agency_owner', 'admin') then v_role else 'system' end,
    p_event, p_subject_kind, p_subject_id,
    p_renter, p_agency, p_booking,
    nullif(p_meta, '{}'::jsonb)
  );
exception when others then
  raise warning 'dev log skipped % (%): %', p_event, p_subject_id, sqlerrm;
end $$;

-- Only the recorders may write through this; a signed-in user calling it
-- over the API could otherwise forge entries (the reason for 065).
revoke all on function public.dev_log_event(uuid, text, text, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- ─── 3. Accounts and identity ───────────────────────────────
create or replace function public.dev_log_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dev_log_event(new.id, 'account.created', 'renter', new.id, new.id, null, null,
      jsonb_build_object('name', new.full_name));
    return new;
  end if;

  if new.kyc_status is distinct from old.kyc_status then
    -- Identity decisions arrive from the verification provider's webhook,
    -- so with no session they are correctly attributed to the system.
    perform public.dev_log_event(null, 'identity.' || new.kyc_status::text, 'renter', new.id, new.id, null, null,
      jsonb_build_object('from', old.kyc_status::text, 'to', new.kyc_status::text));
  end if;
  if new.license_review_status is distinct from old.license_review_status and new.license_review_status is not null then
    perform public.dev_log_event(new.license_reviewed_by, 'identity.licence_' || new.license_review_status, 'renter', new.id, new.id, null, null,
      jsonb_build_object('from', old.license_review_status, 'to', new.license_review_status));
  end if;
  if coalesce(new.phone_verified, false) and not coalesce(old.phone_verified, false) then
    perform public.dev_log_event(new.id, 'account.phone_verified', 'renter', new.id, new.id, null, null, null);
  end if;
  if new.email_verified_at is not null and old.email_verified_at is null then
    perform public.dev_log_event(new.id, 'account.email_verified', 'renter', new.id, new.id, null, null, null);
  end if;
  if new.role is distinct from old.role then
    perform public.dev_log_event(null, 'account.role_changed', 'renter', new.id, new.id, null, null,
      jsonb_build_object('from', old.role::text, 'to', new.role::text));
  end if;
  if new.is_blacklisted is distinct from old.is_blacklisted then
    perform public.dev_log_event(null, case when new.is_blacklisted then 'account.blacklisted' else 'account.unblacklisted' end,
      'renter', new.id, new.id, null, null, null);
  end if;
  if new.booking_frozen is distinct from old.booking_frozen then
    perform public.dev_log_event(null, case when new.booking_frozen then 'account.bookings_frozen' else 'account.bookings_unfrozen' end,
      'renter', new.id, new.id, null, null, null);
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.dev_log_event(null, 'account.deleted', 'renter', new.id, new.id, null, null, null);
  end if;
  return new;
end $$;

drop trigger if exists trg_dev_log_profiles on public.profiles;
create trigger trg_dev_log_profiles
  after insert or update on public.profiles
  for each row execute function public.dev_log_profiles();

-- ─── 4. Rental Pages ────────────────────────────────────────
create or replace function public.dev_log_agencies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dev_log_event(new.owner_id, 'page.created', 'agency', new.id, null, new.id, null,
      jsonb_build_object('name', new.name, 'page_type', new.page_type, 'city', new.city));
    return new;
  end if;

  if new.name is distinct from old.name then
    perform public.dev_log_event(null, 'page.renamed', 'agency', new.id, null, new.id, null,
      jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  if new.is_verified is distinct from old.is_verified then
    perform public.dev_log_event(null, case when new.is_verified then 'page.verified' else 'page.unverified' end,
      'agency', new.id, null, new.id, null, null);
  end if;
  if new.whatsapp_verified_at is not null and old.whatsapp_verified_at is null then
    perform public.dev_log_event(null, 'page.whatsapp_verified', 'agency', new.id, null, new.id, null, null);
  end if;
  if new.deactivated_at is distinct from old.deactivated_at then
    perform public.dev_log_event(null, case when new.deactivated_at is null then 'page.reactivated' else 'page.deactivated' end,
      'agency', new.id, null, new.id, null, null);
  end if;
  if new.is_blocked is distinct from old.is_blocked then
    perform public.dev_log_event(null, case when new.is_blocked then 'page.blocked' else 'page.unblocked' end,
      'agency', new.id, null, new.id, null, null);
  end if;
  if new.owner_id is distinct from old.owner_id then
    perform public.dev_log_event(null, 'page.transferred', 'agency', new.id, null, new.id, null,
      jsonb_build_object('from_owner', old.owner_id, 'to_owner', new.owner_id));
  end if;
  if new.listing_auto_approve is distinct from old.listing_auto_approve then
    perform public.dev_log_event(null, case when new.listing_auto_approve then 'page.auto_approve_on' else 'page.auto_approve_off' end,
      'agency', new.id, null, new.id, null, null);
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.dev_log_event(null, 'page.deleted', 'agency', new.id, null, new.id, null,
      jsonb_build_object('source', new.deletion_source));
  end if;
  return new;
end $$;

drop trigger if exists trg_dev_log_agencies on public.agencies;
create trigger trg_dev_log_agencies
  after insert or update on public.agencies
  for each row execute function public.dev_log_agencies();

-- ─── 5. Listings ────────────────────────────────────────────
create or replace function public.dev_log_vehicles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := concat_ws(' ', new.year::text, new.make, new.model);
begin
  if tg_op = 'INSERT' then
    perform public.dev_log_event(new.listing_authority_confirmed_by, 'vehicle.created', 'vehicle', new.id, null, new.agency_id, null,
      jsonb_build_object('name', v_name, 'status', new.status::text));
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.dev_log_event(null, 'vehicle.' || new.status::text, 'vehicle', new.id, null, new.agency_id, null,
      jsonb_build_object('name', v_name, 'from', old.status::text, 'to', new.status::text,
        'reason', case when new.status::text in ('unlisted', 'pending_review') then new.rejection_reason end));
  end if;
  if new.daily_rate_lkr is distinct from old.daily_rate_lkr or new.deposit_lkr is distinct from old.deposit_lkr then
    perform public.dev_log_event(null, 'vehicle.price_changed', 'vehicle', new.id, null, new.agency_id, null,
      jsonb_build_object('name', v_name,
        'daily_from', old.daily_rate_lkr, 'daily_to', new.daily_rate_lkr,
        'deposit_from', old.deposit_lkr, 'deposit_to', new.deposit_lkr));
  end if;
  if new.is_featured is distinct from old.is_featured then
    perform public.dev_log_event(null, case when new.is_featured then 'vehicle.featured' else 'vehicle.unfeatured' end,
      'vehicle', new.id, null, new.agency_id, null, jsonb_build_object('name', v_name));
  end if;
  if new.verified_vehicle is distinct from old.verified_vehicle then
    perform public.dev_log_event(null, case when new.verified_vehicle then 'vehicle.verified' else 'vehicle.unverified' end,
      'vehicle', new.id, null, new.agency_id, null, jsonb_build_object('name', v_name));
  end if;
  if new.paused_at is distinct from old.paused_at then
    perform public.dev_log_event(null, case when new.paused_at is null then 'vehicle.resumed' else 'vehicle.paused' end,
      'vehicle', new.id, null, new.agency_id, null, jsonb_build_object('name', v_name));
  end if;
  if coalesce(array_length(new.photos, 1), 0) is distinct from coalesce(array_length(old.photos, 1), 0) then
    perform public.dev_log_event(null, 'vehicle.photos_changed', 'vehicle', new.id, null, new.agency_id, null,
      jsonb_build_object('name', v_name,
        'from_count', coalesce(array_length(old.photos, 1), 0),
        'to_count', coalesce(array_length(new.photos, 1), 0)));
  end if;
  if new.plate_number is distinct from old.plate_number then
    -- The plate itself is private until a booking is confirmed.
    perform public.dev_log_event(null, 'vehicle.plate_changed', 'vehicle', new.id, null, new.agency_id, null,
      jsonb_build_object('name', v_name));
  end if;
  return new;
end $$;

drop trigger if exists trg_dev_log_vehicles on public.vehicles;
create trigger trg_dev_log_vehicles
  after insert or update on public.vehicles
  for each row execute function public.dev_log_vehicles();

-- ─── 6. Rental Page team ────────────────────────────────────
create or replace function public.dev_log_agency_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dev_log_event(new.invited_by, 'team.member_added', 'agency', new.agency_id, new.user_id, new.agency_id, null,
      jsonb_build_object('role', new.role));
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform public.dev_log_event(null, 'team.member_removed', 'agency', old.agency_id, old.user_id, old.agency_id, null,
      jsonb_build_object('role', old.role));
    return old;
  end if;
  if new.role is distinct from old.role then
    perform public.dev_log_event(null, 'team.role_changed', 'agency', new.agency_id, new.user_id, new.agency_id, null,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.can_view_renter_documents is distinct from old.can_view_renter_documents then
    perform public.dev_log_event(new.document_permission_granted_by,
      case when new.can_view_renter_documents then 'team.document_access_granted' else 'team.document_access_revoked' end,
      'agency', new.agency_id, new.user_id, new.agency_id, null, null);
  end if;
  return new;
end $$;

drop trigger if exists trg_dev_log_agency_members on public.agency_members;
create trigger trg_dev_log_agency_members
  after insert or update or delete on public.agency_members
  for each row execute function public.dev_log_agency_members();

-- ─── 7. Reviews ─────────────────────────────────────────────
create or replace function public.dev_log_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- agency_id is filled by the BEFORE trigger trg_set_review_agency, so it is
  -- present here; the booking is the fallback subject if it ever is not.
  if new.agency_id is not null then
    perform public.dev_log_event(new.reviewer_id, 'review.posted', 'agency', new.agency_id,
      new.reviewer_id, new.agency_id, new.booking_id, jsonb_build_object('rating', new.rating));
  else
    perform public.dev_log_event(new.reviewer_id, 'review.posted', 'booking', new.booking_id,
      new.reviewer_id, null, new.booking_id, jsonb_build_object('rating', new.rating));
  end if;
  return new;
end $$;

drop trigger if exists trg_dev_log_reviews on public.reviews;
create trigger trg_dev_log_reviews
  after insert on public.reviews
  for each row execute function public.dev_log_reviews();

-- ─── 8. The existing booking recorder ───────────────────────
-- Same reasoning as point 3: without this, a booking status change made
-- from a signed-in session (rather than a server route) would fail on the
-- revoked INSERT and take the status change down with it.
alter function public.log_booking_lifecycle() security definer set search_path = public;
