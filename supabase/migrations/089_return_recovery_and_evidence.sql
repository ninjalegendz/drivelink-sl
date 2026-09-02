-- 089 - Agreed extensions, evidence-based overdue review, durable notices,
-- and privacy-scoped evidence exports.

alter table public.bookings
  add column if not exists extended_end_at timestamptz,
  add column if not exists overdue_review_prompted_at timestamptz;

create table if not exists public.booking_extensions (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings(id) on delete cascade,
  requested_by          uuid not null references public.profiles(id),
  requested_by_side     text not null check (requested_by_side in ('renter', 'page')),
  proposed_end_at       timestamptz not null,
  reason                text not null check (char_length(reason) between 10 and 1000),
  status                text not null check (status in ('requested', 'offered', 'accepted', 'declined', 'withdrawn')),
  additional_rental_lkr integer check (additional_rental_lkr is null or additional_rental_lkr between 0 and 10000000),
  offered_by            uuid references public.profiles(id),
  offered_at            timestamptz,
  responded_by          uuid references public.profiles(id),
  responded_at          timestamptz,
  accepted_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists idx_booking_extensions_one_open
  on public.booking_extensions (booking_id)
  where status in ('requested', 'offered');
create index if not exists idx_booking_extensions_history
  on public.booking_extensions (booking_id, created_at desc);

drop trigger if exists trg_booking_extensions_updated_at on public.booking_extensions;
create trigger trg_booking_extensions_updated_at
  before update on public.booking_extensions
  for each row execute function public.set_updated_at();

create table if not exists public.booking_contact_attempts (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  actor_id      uuid not null references public.profiles(id),
  actor_side    text not null check (actor_side in ('page', 'admin')),
  channel       text not null check (channel in ('call', 'whatsapp', 'sms', 'email', 'in_person')),
  outcome       text not null check (outcome in ('answered', 'no_answer', 'message_sent', 'number_unavailable', 'promised_return', 'extension_discussed', 'other')),
  note          text not null check (char_length(note) between 5 and 1000),
  attempted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_booking_contact_attempts_timeline
  on public.booking_contact_attempts (booking_id, attempted_at desc);

create table if not exists public.booking_overdue_reviews (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  requested_by    uuid not null references public.profiles(id),
  reason          text not null check (char_length(reason) between 20 and 2000),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  requested_at    timestamptz not null default now(),
  decided_by      uuid references public.profiles(id),
  decision_note   text,
  decided_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_booking_overdue_reviews_queue
  on public.booking_overdue_reviews (status, requested_at);

drop trigger if exists trg_booking_overdue_reviews_updated_at on public.booking_overdue_reviews;
create trigger trg_booking_overdue_reviews_updated_at
  before update on public.booking_overdue_reviews
  for each row execute function public.set_updated_at();

create table if not exists public.notification_outbox (
  id             uuid primary key default gen_random_uuid(),
  event_key      text not null unique,
  booking_id     uuid references public.bookings(id) on delete cascade,
  recipient_kind text not null check (recipient_kind in ('renter', 'page', 'admin')),
  phone          text,
  email          text,
  sms_key        text,
  text_body      text not null,
  email_subject  text,
  email_body     text,
  status         text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts       integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  delivered_via text,
  delivered_at  timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_notification_outbox_due
  on public.notification_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

drop trigger if exists trg_notification_outbox_updated_at on public.notification_outbox;
create trigger trg_notification_outbox_updated_at
  before update on public.notification_outbox
  for each row execute function public.set_updated_at();

create table if not exists public.evidence_exports (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  exported_by    uuid not null references public.profiles(id),
  export_kind    text not null check (export_kind in ('summary', 'full')),
  reason         text not null check (char_length(reason) between 10 and 1000),
  file_count     integer,
  byte_size      integer,
  omitted_files jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_evidence_exports_booking
  on public.evidence_exports (booking_id, created_at desc);

alter table public.booking_extensions enable row level security;
alter table public.booking_contact_attempts enable row level security;
alter table public.booking_overdue_reviews enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.evidence_exports enable row level security;

revoke all on public.booking_extensions, public.booking_contact_attempts,
  public.booking_overdue_reviews, public.notification_outbox, public.evidence_exports
  from anon, authenticated;
grant select on public.booking_extensions, public.booking_contact_attempts,
  public.booking_overdue_reviews, public.evidence_exports to authenticated;
grant all on public.booking_extensions, public.booking_contact_attempts,
  public.booking_overdue_reviews, public.notification_outbox, public.evidence_exports to service_role;

create policy "Booking parties read extensions"
  on public.booking_extensions for select using (exists (
    select 1 from public.bookings b where b.id = booking_extensions.booking_id
      and (b.renter_id = auth.uid() or b.agency_id in (select public.acting_agency_ids()))
  ) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Booking parties read contact attempts"
  on public.booking_contact_attempts for select using (exists (
    select 1 from public.bookings b where b.id = booking_contact_attempts.booking_id
      and (b.renter_id = auth.uid() or b.agency_id in (select public.acting_agency_ids()))
  ) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Booking parties read overdue reviews"
  on public.booking_overdue_reviews for select using (exists (
    select 1 from public.bookings b where b.id = booking_overdue_reviews.booking_id
      and (b.renter_id = auth.uid() or b.agency_id in (select public.acting_agency_ids()))
  ) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Renter reads evidence export history"
  on public.evidence_exports for select using (exists (
    select 1 from public.bookings b where b.id = evidence_exports.booking_id and b.renter_id = auth.uid()
  ));
create policy "Page owners read evidence export history"
  on public.evidence_exports for select using (exists (
    select 1 from public.bookings b join public.agencies a on a.id = b.agency_id
    where b.id = evidence_exports.booking_id and a.owner_id = auth.uid()
  ));
create policy "Admins read evidence export history"
  on public.evidence_exports for select using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Extension rental is a mutually accepted booking amount, not a provider-
-- invented return charge. It shares the ledger so it cannot be forgotten at
-- final direct-payment reconciliation.
alter table public.booking_charges drop constraint if exists booking_charges_kind_check;
alter table public.booking_charges add constraint booking_charges_kind_check check (kind in
  ('extra_km','fuel','late','cleaning','damage','delivery','driver','toll','other','extension'));

create or replace function public.request_booking_extension(
  p_booking_id uuid,
  p_actor_id uuid,
  p_proposed_end_at timestamptz,
  p_reason text,
  p_additional_rental_lkr integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  side text;
  is_page_actor boolean := false;
  current_end timestamptz;
  ext public.booking_extensions%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;

  select exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
      or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if b.renter_id = p_actor_id then side := 'renter';
  elsif is_page_actor then side := 'page';
  else raise exception using errcode = '42501', message = 'You cannot change this booking.';
  end if;

  if b.status::text <> 'active' or b.renter_returned_at is not null then
    raise exception using errcode = 'P0001', message = 'More time can only be agreed while the rental is active and not yet returned.';
  end if;
  if b.overdue_critical_at is not null then
    raise exception using errcode = 'P0001', message = 'DriveLink has already confirmed a critical return case. Contact support.';
  end if;
  if char_length(clean_reason) not between 10 and 1000 then
    raise exception using errcode = 'P0001', message = 'Explain the extension in at least 10 characters.';
  end if;
  current_end := coalesce(b.extended_end_at, b.end_at);
  if p_proposed_end_at <= current_end or p_proposed_end_at <= now() + interval '15 minutes'
     or p_proposed_end_at > greatest(current_end, now()) + interval '30 days' then
    raise exception using errcode = 'P0001', message = 'Choose a future return time, no more than 30 days after the current return time.';
  end if;
  if exists (select 1 from public.booking_extensions e where e.booking_id = b.id and e.status in ('requested', 'offered')) then
    raise exception using errcode = 'P0001', message = 'Answer the open extension before creating another one.';
  end if;
  if side = 'page' and (p_additional_rental_lkr is null or p_additional_rental_lkr < 0) then
    raise exception using errcode = 'P0001', message = 'Enter the exact additional rental amount, including zero when no extra payment is due.';
  end if;
  if p_additional_rental_lkr is not null and p_additional_rental_lkr > 10000000 then
    raise exception using errcode = 'P0001', message = 'The extension amount is too high.';
  end if;

  insert into public.booking_extensions (
    booking_id, requested_by, requested_by_side, proposed_end_at, reason, status,
    additional_rental_lkr, offered_by, offered_at
  ) values (
    b.id, p_actor_id, side, p_proposed_end_at, clean_reason,
    case when side = 'page' then 'offered' else 'requested' end,
    case when side = 'page' then p_additional_rental_lkr else null end,
    case when side = 'page' then p_actor_id else null end,
    case when side = 'page' then now() else null end
  ) returning * into ext;

  insert into public.activity_events (
    actor_id, actor_role, event_type, subject_kind, subject_id,
    related_renter_id, related_agency_id, related_booking_id, metadata
  ) values (
    p_actor_id, case when side = 'page' then 'agency_owner' else 'renter' end,
    case when side = 'page' then 'booking.extension_offered' else 'booking.extension_requested' end,
    'booking', b.id, b.renter_id, b.agency_id, b.id,
    jsonb_build_object('extension_id', ext.id, 'proposed_end_at', p_proposed_end_at, 'additional_rental_lkr', p_additional_rental_lkr)
  );
  return to_jsonb(ext);
end;
$$;

create or replace function public.respond_booking_extension(
  p_extension_id uuid,
  p_actor_id uuid,
  p_action text,
  p_additional_rental_lkr integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  ext public.booking_extensions%rowtype;
  b public.bookings%rowtype;
  is_page_actor boolean := false;
  now_at timestamptz := now();
begin
  select * into ext from public.booking_extensions where id = p_extension_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Extension not found.'; end if;
  select * into b from public.bookings where id = ext.booking_id for update;
  if b.status::text <> 'active' or b.renter_returned_at is not null or b.overdue_critical_at is not null then
    raise exception using errcode = 'P0001', message = 'This extension can no longer be changed.';
  end if;
  select exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
      or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;

  if p_action = 'withdraw' then
    if ext.requested_by <> p_actor_id or ext.status not in ('requested', 'offered') then
      raise exception using errcode = '42501', message = 'Only the person who opened this extension can withdraw it.';
    end if;
    update public.booking_extensions set status = 'withdrawn', responded_by = p_actor_id, responded_at = now_at where id = ext.id;
    return jsonb_build_object('ok', true, 'status', 'withdrawn');
  end if;

  if ext.status = 'requested' then
    if not is_page_actor then raise exception using errcode = '42501', message = 'The Rental Page must answer this request.'; end if;
    if p_action = 'decline' then
      update public.booking_extensions set status = 'declined', responded_by = p_actor_id, responded_at = now_at where id = ext.id;
      return jsonb_build_object('ok', true, 'status', 'declined');
    end if;
    if p_action <> 'offer' or p_additional_rental_lkr is null or p_additional_rental_lkr not between 0 and 10000000 then
      raise exception using errcode = 'P0001', message = 'Enter the exact extension amount before sending the offer.';
    end if;
    update public.booking_extensions
    set status = 'offered', additional_rental_lkr = p_additional_rental_lkr,
        offered_by = p_actor_id, offered_at = now_at
    where id = ext.id;
    return jsonb_build_object('ok', true, 'status', 'offered');
  end if;

  if ext.status <> 'offered' then raise exception using errcode = 'P0001', message = 'This extension was already answered.'; end if;
  if b.renter_id <> p_actor_id then raise exception using errcode = '42501', message = 'Only the renter can accept the final time and amount.'; end if;
  if p_action = 'decline' then
    update public.booking_extensions set status = 'declined', responded_by = p_actor_id, responded_at = now_at where id = ext.id;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;
  if p_action <> 'accept' then raise exception using errcode = 'P0001', message = 'Choose accept or decline.'; end if;

  update public.booking_extensions
  set status = 'accepted', responded_by = p_actor_id, responded_at = now_at, accepted_at = now_at
  where id = ext.id;
  update public.bookings
  set extended_end_at = ext.proposed_end_at,
      overdue_notified_at = null,
      overdue_review_prompted_at = null
  where id = b.id;

  if coalesce(ext.additional_rental_lkr, 0) > 0 then
    insert into public.booking_charges (
      booking_id, kind, label, amount_lkr, approved_amount_lkr, created_by,
      status, evidence_urls, basis, renter_responded_at
    ) values (
      b.id, 'extension', 'Agreed rental extension', ext.additional_rental_lkr,
      ext.additional_rental_lkr, ext.offered_by, 'accepted', '{}',
      jsonb_build_object('extension_id', ext.id, 'previous_end_at', coalesce(b.extended_end_at, b.end_at), 'new_end_at', ext.proposed_end_at),
      now_at
    );
  end if;

  insert into public.activity_events (
    actor_id, actor_role, event_type, subject_kind, subject_id,
    related_renter_id, related_agency_id, related_booking_id, metadata
  ) values (
    p_actor_id, 'renter', 'booking.extension_accepted', 'booking', b.id,
    b.renter_id, b.agency_id, b.id,
    jsonb_build_object('extension_id', ext.id, 'new_end_at', ext.proposed_end_at, 'additional_rental_lkr', ext.additional_rental_lkr)
  );
  return jsonb_build_object('ok', true, 'status', 'accepted', 'extendedEndAt', ext.proposed_end_at);
end;
$$;

create or replace function public.record_booking_contact_attempt(
  p_booking_id uuid,
  p_actor_id uuid,
  p_channel text,
  p_outcome text,
  p_note text,
  p_attempted_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  is_page_actor boolean := false;
  actor_side text;
  inserted public.booking_contact_attempts%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  select exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
      or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if is_page_actor then actor_side := 'page';
  elsif exists (select 1 from public.profiles p where p.id = p_actor_id and p.role = 'admin') then actor_side := 'admin';
  else raise exception using errcode = '42501', message = 'Only the Rental Page or DriveLink support can record contact attempts.';
  end if;
  if b.status::text <> 'active' or b.renter_returned_at is not null then
    raise exception using errcode = 'P0001', message = 'Contact attempts are only recorded for an active, unreturned rental.';
  end if;
  if p_channel not in ('call', 'whatsapp', 'sms', 'email', 'in_person')
    or p_outcome not in ('answered', 'no_answer', 'message_sent', 'number_unavailable', 'promised_return', 'extension_discussed', 'other') then
    raise exception using errcode = 'P0001', message = 'Choose a valid contact method and result.';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 5 and 1000 then
    raise exception using errcode = 'P0001', message = 'Add a short factual note of at least 5 characters.';
  end if;
  if p_attempted_at > now() + interval '5 minutes' or p_attempted_at < now() - interval '7 days' then
    raise exception using errcode = 'P0001', message = 'The contact time must be within the last 7 days.';
  end if;
  insert into public.booking_contact_attempts (booking_id, actor_id, actor_side, channel, outcome, note, attempted_at)
  values (b.id, p_actor_id, actor_side, p_channel, p_outcome, btrim(p_note), p_attempted_at)
  returning * into inserted;
  return to_jsonb(inserted);
end;
$$;

create or replace function public.request_overdue_review(
  p_booking_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  is_page_actor boolean := false;
  attempt_count integer;
  channel_count integer;
  call_count integer;
  written_count integer;
  first_attempt timestamptz;
  last_attempt timestamptz;
  review public.booking_overdue_reviews%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  select exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
      or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if not is_page_actor then raise exception using errcode = '42501', message = 'Only the Rental Page can request an overdue review.'; end if;
  if b.status::text <> 'active' or b.renter_returned_at is not null then
    raise exception using errcode = 'P0001', message = 'This rental is no longer awaiting return.';
  end if;
  if now() < coalesce(b.extended_end_at, b.end_at) + interval '24 hours' then
    raise exception using errcode = 'P0001', message = 'Critical review becomes available 24 hours after the currently agreed return time.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 20 and 2000 then
    raise exception using errcode = 'P0001', message = 'Explain the situation factually in at least 20 characters.';
  end if;
  if exists (select 1 from public.booking_overdue_reviews r where r.booking_id = b.id and r.status in ('pending', 'approved')) then
    raise exception using errcode = 'P0001', message = 'This overdue case is already under review.';
  end if;

  select count(*), count(distinct channel),
         count(*) filter (where channel = 'call'),
         count(*) filter (where channel in ('whatsapp', 'sms', 'email')),
         min(attempted_at), max(attempted_at)
  into attempt_count, channel_count, call_count, written_count, first_attempt, last_attempt
  from public.booking_contact_attempts a
  where a.booking_id = b.id and a.actor_side = 'page'
    and a.attempted_at >= coalesce(b.extended_end_at, b.end_at) - interval '2 hours';

  if attempt_count < 2 or channel_count < 2 or call_count < 1 or written_count < 1
     or last_attempt - first_attempt < interval '15 minutes' then
    raise exception using errcode = 'P0001', message = 'Record at least one call and one written contact attempt, at least 15 minutes apart.';
  end if;

  insert into public.booking_overdue_reviews (
    booking_id, requested_by, reason, status, evidence_snapshot, requested_at,
    decided_by, decision_note, decided_at
  ) values (
    b.id, p_actor_id, btrim(p_reason), 'pending',
    jsonb_build_object(
      'agreed_return_at', coalesce(b.extended_end_at, b.end_at),
      'attempt_count', attempt_count, 'channel_count', channel_count,
      'first_attempt_at', first_attempt, 'last_attempt_at', last_attempt
    ), now(), null, null, null
  )
  on conflict (booking_id) do update set
    requested_by = excluded.requested_by,
    reason = excluded.reason,
    status = 'pending',
    evidence_snapshot = excluded.evidence_snapshot,
    requested_at = now(),
    decided_by = null,
    decision_note = null,
    decided_at = null
  returning * into review;

  return to_jsonb(review);
end;
$$;

create or replace function public.decide_overdue_review(
  p_review_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  review public.booking_overdue_reviews%rowtype;
  b public.bookings%rowtype;
  final_status text;
begin
  if not exists (select 1 from public.profiles p where p.id = p_admin_id and p.role = 'admin') then
    raise exception using errcode = '42501', message = 'Admin access required.';
  end if;
  if p_decision not in ('approve', 'reject') then raise exception using errcode = 'P0001', message = 'Choose approve or reject.'; end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 10 and 2000 then
    raise exception using errcode = 'P0001', message = 'Add a clear decision note of at least 10 characters.';
  end if;
  select * into review from public.booking_overdue_reviews where id = p_review_id for update;
  if not found or review.status <> 'pending' then raise exception using errcode = 'P0002', message = 'Pending overdue review not found.'; end if;
  select * into b from public.bookings where id = review.booking_id for update;
  if b.status::text <> 'active' or b.renter_returned_at is not null then
    raise exception using errcode = 'P0001', message = 'The vehicle is no longer recorded as unreturned.';
  end if;
  if exists (select 1 from public.booking_extensions e where e.booking_id = b.id and e.status in ('requested', 'offered')) then
    raise exception using errcode = 'P0001', message = 'Answer the open extension before deciding this review.';
  end if;
  final_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  update public.booking_overdue_reviews
  set status = final_status, decided_by = p_admin_id, decision_note = btrim(p_note), decided_at = now()
  where id = review.id;
  if p_decision = 'approve' then
    update public.bookings set overdue_critical_at = now() where id = b.id;
    update public.profiles set booking_frozen = true where id = b.renter_id;
  else
    update public.bookings set overdue_critical_at = null where id = b.id;
  end if;
  insert into public.activity_events (
    actor_id, actor_role, event_type, subject_kind, subject_id,
    related_renter_id, related_agency_id, related_booking_id, metadata
  ) values (
    p_admin_id, 'admin', 'booking.overdue_review_' || final_status, 'booking', b.id,
    b.renter_id, b.agency_id, b.id,
    jsonb_build_object('review_id', review.id, 'decision_note', btrim(p_note))
  );
  return jsonb_build_object('ok', true, 'status', final_status, 'bookingFrozen', p_decision = 'approve');
end;
$$;

create or replace function public.ensure_late_return_charge(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  terms jsonb;
  scheduled_return timestamptz;
  unit_rate integer;
  late_hours integer;
  amount integer;
  inserted public.booking_charges%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  if b.status::text <> 'active' or b.renter_returned_at is null then
    raise exception using errcode = 'P0001', message = 'A late-return item is calculated only after the renter records the return.';
  end if;
  select a.terms into terms from public.booking_agreements a where a.booking_id = b.id;
  if terms is null then raise exception using errcode = 'P0001', message = 'The signed agreement terms are missing.'; end if;
  if exists (select 1 from public.booking_charges c where c.booking_id = b.id and c.kind = 'late' and c.status <> 'waived') then
    select * into inserted from public.booking_charges c where c.booking_id = b.id and c.kind = 'late' and c.status <> 'waived' order by c.created_at limit 1;
    return to_jsonb(inserted);
  end if;
  scheduled_return := coalesce(b.extended_end_at, b.end_at);
  unit_rate := coalesce(nullif(terms #>> '{fees,late_fee_per_hour_lkr}', '')::integer, ceil(b.daily_rate_lkr::numeric / 8)::integer);
  late_hours := greatest(ceil(extract(epoch from (b.renter_returned_at - (scheduled_return + interval '2 hours'))) / 3600)::integer, 0);
  amount := least(late_hours * unit_rate, b.daily_rate_lkr);
  if amount <= 0 then return jsonb_build_object('created', false, 'amount_lkr', 0); end if;
  insert into public.booking_charges (
    booking_id, kind, label, amount_lkr, created_by, status, evidence_urls, basis
  ) values (
    b.id, 'late', format('%s chargeable hour%s after the 2-hour grace period', late_hours, case when late_hours = 1 then '' else 's' end),
    amount, null, 'proposed', '{}',
    jsonb_build_object(
      'scheduled_return_at', scheduled_return, 'actual_return_at', b.renter_returned_at,
      'grace_hours', 2, 'chargeable_hours', late_hours,
      'rate_lkr_per_hour', unit_rate, 'daily_rate_cap_lkr', b.daily_rate_lkr,
      'maximum_lkr', amount, 'system_calculated', true
    )
  ) returning * into inserted;
  return to_jsonb(inserted);
end;
$$;

revoke all on function public.request_booking_extension(uuid, uuid, timestamptz, text, integer) from public, anon, authenticated;
revoke all on function public.respond_booking_extension(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.record_booking_contact_attempt(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.request_overdue_review(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.decide_overdue_review(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.ensure_late_return_charge(uuid) from public, anon, authenticated;

grant execute on function public.request_booking_extension(uuid, uuid, timestamptz, text, integer) to service_role;
grant execute on function public.respond_booking_extension(uuid, uuid, text, integer) to service_role;
grant execute on function public.record_booking_contact_attempt(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.request_overdue_review(uuid, uuid, text) to service_role;
grant execute on function public.decide_overdue_review(uuid, uuid, text, text) to service_role;
grant execute on function public.ensure_late_return_charge(uuid) to service_role;
