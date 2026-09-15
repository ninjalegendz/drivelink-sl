-- 128: take the friction out of listing a vehicle.
--
-- 1. A Rental Page whose WhatsApp number is the phone this account already
--    verified with a code at signup does not need a second code for the same
--    number. Any other number still goes through page phone verification.
--
-- 2. Once DriveLink has approved one listing from a page, that page's later
--    listings go live as soon as they are complete (plate, four photos, a
--    rental mode, a price, and the right-to-list declaration). Admins can see
--    and spot-check every listing that went live this way, and rejecting any
--    listing from the page switches it off again. Admin moderation, which runs
--    on the service role, is never overridden.

-- ── 1. Trust a page number that is the account's verified phone ──

create or replace function public.page_number_is_verified_account_phone(p_owner_id uuid, p_number text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p_number is not null and exists (
    select 1
    from public.profiles p
    where p.id = p_owner_id
      and p.phone_verified = true
      and p.phone is not null
      and p.phone = p_number
  );
$$;

revoke all on function public.page_number_is_verified_account_phone(uuid, text) from public, anon, authenticated;

-- Replaces the 101 version: a changed number is still reset, unless the new
-- number is the account's own verified phone.
create or replace function public.reset_page_phone_verification_on_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.whatsapp_number is distinct from old.whatsapp_number then
    if new.whatsapp_number is null
       or new.whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception using errcode = 'P0001', message = 'Rental Page phone numbers must use international format.';
    end if;

    new.whatsapp_verified_at := case
      when public.page_number_is_verified_account_phone(new.owner_id, new.whatsapp_number) then clock_timestamp()
      else null
    end;
    new.page_otp_hash := null;
    new.page_otp_expires_at := null;

    delete from public.otp_challenges
    where subject_key = 'page:' || old.owner_id::text || ':' || old.id::text
      and purpose = 'phone_verify';
  end if;
  return new;
end;
$$;

revoke all on function public.reset_page_phone_verification_on_change() from public, anon, authenticated;

-- Pausing live listings after a number change exists so an unverified number
-- never takes bookings. A number that is verified on the spot needs no pause.
create or replace function public.pause_page_vehicles_after_phone_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.deleted_at is null
     and new.whatsapp_number is distinct from old.whatsapp_number
     and new.whatsapp_verified_at is null then
    update public.vehicles
    set status = 'unlisted', paused_at = coalesce(paused_at, now())
    where agency_id = new.id and status = 'available';
  end if;
  return new;
end;
$$;

create or replace function public.trust_page_number_matching_account_phone()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.whatsapp_verified_at is null
     and public.page_number_is_verified_account_phone(new.owner_id, new.whatsapp_number) then
    new.whatsapp_verified_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.trust_page_number_matching_account_phone() from public, anon, authenticated;

drop trigger if exists trg_trust_page_number_matching_account_phone on public.agencies;
create trigger trg_trust_page_number_matching_account_phone
before insert on public.agencies
for each row execute function public.trust_page_number_matching_account_phone();

-- Pages created before this rule that already use the verified account phone.
update public.agencies a
set whatsapp_verified_at = now()
from public.profiles p
where p.id = a.owner_id
  and a.deleted_at is null
  and a.whatsapp_verified_at is null
  and p.phone_verified = true
  and p.phone is not null
  and p.phone = a.whatsapp_number;

-- ── 2. Trusted pages publish complete listings straight away ──

alter table public.agencies
  add column if not exists listing_auto_approve boolean not null default false;
alter table public.vehicles
  add column if not exists auto_published_at timestamptz;

comment on column public.agencies.listing_auto_approve is
  'Set when DriveLink approves a listing from this page; cleared when one is rejected. Complete listings from a trusted page go live without waiting for review.';
comment on column public.vehicles.auto_published_at is
  'When this listing last went live on its own because its page is trusted. Null once an admin moderates it.';

-- Owners and staff never write either column (neither is in their column
-- grants); reading them is harmless and keeps select("*") working.
grant select (listing_auto_approve) on public.agencies to authenticated;
grant select (auto_published_at) on public.vehicles to authenticated;

create or replace function public.rental_page_auto_publishes(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.rental_page_is_public(p_agency_id)
    and exists (
      select 1 from public.agencies a
      where a.id = p_agency_id and a.listing_auto_approve = true
    );
$$;

revoke all on function public.rental_page_auto_publishes(uuid) from public, anon;
grant execute on function public.rental_page_auto_publishes(uuid) to authenticated;

-- Deliberately SECURITY INVOKER: current_user must stay the real caller so the
-- service-role check below means what it says.
create or replace function public.auto_publish_trusted_listing()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.auto_published_at := null;
  end if;

  if new.status::text <> 'pending_review' then
    return new;
  end if;

  -- An owner who hid a listing and then edits it must not see it reappear.
  -- Only new listings, live or queued listings, and drafts that were never
  -- declared (for example one DriveLink drafted for them) qualify.
  if tg_op = 'UPDATE' and not (
    old.status::text in ('available', 'pending_review')
    or (old.status::text = 'unlisted'
        and old.listing_authority_confirmed_at is null
        and old.rejection_reason is null)
  ) then
    return new;
  end if;

  if new.rejection_reason is not null
     or new.plate_number is null or length(btrim(new.plate_number)) < 3
     or coalesce(array_length(new.photos, 1), 0) < 4
     or not (coalesce(new.self_drive, false) or coalesce(new.with_driver, false))
     or coalesce(new.daily_rate_lkr, 0) < 500
     or coalesce(new.listing_authority_declared, false) = false
     or new.listing_authority_basis is null
     or new.listing_authority_basis::text not in ('registered_owner', 'authorized_operator')
     or new.listing_authority_confirmed_at is null
     or new.listing_authority_confirmed_by is null
     or new.listing_authority_declaration_version is distinct from 'vehicle-authority-v1' then
    return new;
  end if;

  if not public.rental_page_auto_publishes(new.agency_id) then
    return new;
  end if;

  new.status := 'available';
  new.auto_published_at := clock_timestamp();
  return new;
end;
$$;

-- Named to sort after every other BEFORE trigger on vehicles, so it sees the
-- status the requeue guards and the insert guard have already settled on.
drop trigger if exists zz_auto_publish_trusted_listing on public.vehicles;
create trigger zz_auto_publish_trusted_listing
before insert or update on public.vehicles
for each row execute function public.auto_publish_trusted_listing();

-- Pages that already have a listing DriveLink approved.
update public.agencies a
set listing_auto_approve = true
where a.listing_auto_approve = false
  and exists (
    select 1 from public.vehicles v
    where v.agency_id = a.id
      and v.status::text in ('available', 'rented', 'maintenance')
  );
