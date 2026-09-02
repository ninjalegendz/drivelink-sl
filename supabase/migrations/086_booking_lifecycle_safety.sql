-- 086 - Atomic booking lifecycle, inspection handshakes, disputes, and cron health.
--
-- The application used to check lifecycle prerequisites with several reads and
-- then perform a separate update. Two requests could therefore pass the same
-- checks, and completion could happen before return/deposit/settlement closure.
-- These service-role-only functions lock the booking row and perform each
-- decision as one database transaction.

create unique index if not exists idx_incidents_one_unresolved_per_booking
  on public.incidents (booking_id)
  where status in ('open', 'awaiting_response', 'escalated');

create table if not exists public.job_heartbeats (
  job_name       text primary key,
  last_started_at timestamptz not null,
  last_ok_at      timestamptz,
  last_error      text,
  details         jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.job_heartbeats enable row level security;
revoke all on public.job_heartbeats from anon, authenticated;
grant all on public.job_heartbeats to service_role;

create or replace function public.transition_booking_lifecycle(
  p_booking_id uuid,
  p_actor_id uuid,
  p_to text,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  actor_role text;
  is_page_actor boolean := false;
  pickup public.booking_inspections%rowtype;
  return_report public.booking_inspections%rowtype;
  unresolved_count integer := 0;
  now_at timestamptz := now();
  clean_resolution_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
begin
  select * into b
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;

  select role::text into actor_role
  from public.profiles
  where id = p_actor_id;

  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;

  if actor_role = 'admin' then
    if b.status::text = 'pending_confirmation' and p_to in ('confirmed', 'declined', 'cancelled') then
      null;
    elsif b.status::text = 'confirmed' and p_to = 'cancelled' then
      null;
    elsif b.status::text = 'disputed' and p_to in ('completed', 'cancelled') then
      if clean_resolution_note is null or length(clean_resolution_note) < 5 then
        raise exception using errcode = 'P0001', message = 'Add a clear resolution note before closing this dispute.';
      end if;
    else
      raise exception using errcode = 'P0001', message = format('That admin change is not allowed from %s to %s.', b.status::text, p_to);
    end if;
  else
    if not is_page_actor then
      raise exception using errcode = '42501', message = 'You cannot manage this booking.';
    end if;

    if not (
      (b.status::text = 'pending_confirmation' and p_to in ('confirmed', 'declined'))
      or (b.status::text = 'confirmed' and p_to = 'active')
      or (b.status::text = 'active' and p_to = 'completed')
    ) then
      raise exception using errcode = 'P0001', message = format('That change is not allowed from %s to %s.', b.status::text, p_to);
    end if;
  end if;

  if p_to = 'active' then
    if b.start_at is not null and now_at < b.start_at - interval '24 hours' then
      raise exception using errcode = 'P0001', message = 'It is too early to start this rental. Start is available from 24 hours before pickup.';
    end if;

    if not exists (
      select 1 from public.booking_agreements a
      where a.booking_id = b.id
        and a.renter_accepted_at is not null
        and a.owner_accepted_at is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Both the renter and Rental Page must sign the agreement before handover.';
    end if;

    select * into pickup
    from public.booking_inspections
    where booking_id = b.id and phase = 'pickup'
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'Record the pickup inspection before starting the rental.';
    end if;
    if pickup.renter_ack_at is null then
      raise exception using errcode = 'P0001', message = 'The renter must approve the pickup inspection before the vehicle is handed over.';
    end if;
    if pickup.renter_dispute_note is not null then
      raise exception using errcode = 'P0001', message = 'The pickup inspection has a reported difference that must be resolved first.';
    end if;
    if not pickup.plate_confirmed then
      raise exception using errcode = 'P0001', message = 'Confirm that the number plate matches the listing before handover.';
    end if;
    if b.rental_mode = 'self_drive'
      and coalesce(pickup.checklist ->> 'documents_present', 'false') <> 'true' then
      raise exception using errcode = 'P0001', message = 'Inspect the renter original driving licence and any required permit before handover.';
    end if;
    if coalesce(b.deposit_lkr, 0) > 0
      and (b.deposit_received_at is null or b.deposit_received_ack_at is null) then
      raise exception using errcode = 'P0001', message = 'Both sides must confirm the security deposit before handover.';
    end if;
  end if;

  if p_to = 'completed' and b.status::text = 'active' then
    if b.renter_returned_at is null then
      raise exception using errcode = 'P0001', message = 'The renter must mark the vehicle returned before this booking can close.';
    end if;

    select * into return_report
    from public.booking_inspections
    where booking_id = b.id and phase = 'return'
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'Record the return inspection before completing the booking.';
    end if;
    if return_report.renter_ack_at is null then
      raise exception using errcode = 'P0001', message = 'The renter must approve the return inspection before this booking can close.';
    end if;
    if return_report.renter_dispute_note is not null then
      raise exception using errcode = 'P0001', message = 'The return inspection has a reported difference that must be resolved first.';
    end if;

    select count(*) into unresolved_count
    from public.incidents
    where booking_id = b.id and status in ('open', 'awaiting_response', 'escalated');
    if unresolved_count > 0 then
      raise exception using errcode = 'P0001', message = 'An open problem must be resolved by DriveLink before this booking can close.';
    end if;

    if b.deposit_received_at is not null
      and (b.deposit_returned_at is null or b.deposit_return_ack_at is null) then
      raise exception using errcode = 'P0001', message = 'Both sides must confirm the deposit return before this booking can close.';
    end if;
    if b.settlement_ack_at is null then
      raise exception using errcode = 'P0001', message = 'The renter must accept the final settlement before this booking can close.';
    end if;
  end if;

  if actor_role = 'admin' and b.status::text = 'disputed' then
    update public.incidents
    set status = 'resolved',
        resolved_by = p_actor_id,
        resolved_at = now_at,
        resolution_note = clean_resolution_note
    where booking_id = b.id
      and status in ('open', 'awaiting_response', 'escalated');

    insert into public.activity_events (
      actor_id, actor_role, event_type, subject_kind, subject_id,
      related_renter_id, related_agency_id, related_booking_id, metadata
    ) values (
      p_actor_id, 'admin', 'booking.dispute_resolved_by_admin', 'booking', b.id,
      b.renter_id, b.agency_id, b.id,
      jsonb_build_object('from_status', b.status::text, 'to_status', p_to, 'resolution_note', clean_resolution_note)
    );
  end if;

  update public.bookings
  set status = p_to::public.booking_status,
      confirmed_at = case when p_to = 'confirmed' then now_at else confirmed_at end,
      activated_at = case when p_to = 'active' then now_at else activated_at end,
      declined_at = case when p_to = 'declined' then now_at else declined_at end,
      completed_at = case when p_to = 'completed' then now_at else completed_at end,
      return_confirmed_at = case when p_to = 'completed' then now_at else return_confirmed_at end,
      cancelled_at = case when p_to = 'cancelled' then now_at else cancelled_at end,
      cancelled_by = case when p_to = 'cancelled' and actor_role = 'admin' then 'system' else cancelled_by end,
      cancellation_reason = case
        when p_to = 'cancelled' and actor_role = 'admin' and clean_resolution_note is not null
          then 'Closed by DriveLink after review: ' || clean_resolution_note
        else cancellation_reason
      end
  where id = b.id;

  return jsonb_build_object('ok', true, 'previousStatus', b.status::text, 'newStatus', p_to);
end;
$$;

create or replace function public.save_booking_inspection(
  p_booking_id uuid,
  p_actor_id uuid,
  p_phase text,
  p_odometer_km integer,
  p_fuel_level text,
  p_plate_confirmed boolean,
  p_checklist jsonb,
  p_photo_urls text[],
  p_video_url text,
  p_notes text,
  p_deposit_received boolean default false,
  p_deposit_method text default null,
  p_deposit_return_amount integer default null,
  p_deposit_return_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  existing public.booking_inspections%rowtype;
  saved public.booking_inspections%rowtype;
  is_page_actor boolean := false;
  listed_deposit integer := 0;
  now_at timestamptz := now();
begin
  if p_phase not in ('pickup', 'return') then
    raise exception using errcode = 'P0001', message = 'Invalid inspection phase.';
  end if;
  if p_odometer_km is null or p_odometer_km <= 0 then
    raise exception using errcode = 'P0001', message = 'Enter a valid odometer reading.';
  end if;
  if p_fuel_level not in ('empty', 'quarter', 'half', 'three_quarter', 'full') then
    raise exception using errcode = 'P0001', message = 'Select a valid fuel level.';
  end if;
  if coalesce(cardinality(p_photo_urls), 0) < 4 then
    raise exception using errcode = 'P0001', message = 'Add at least four inspection photos.';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;

  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if not is_page_actor then
    raise exception using errcode = '42501', message = 'You cannot manage this booking.';
  end if;

  if p_phase = 'pickup' and b.status::text <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'The pickup inspection can only be recorded before the rental starts.';
  end if;
  if p_phase = 'return' and b.status::text <> 'active' then
    raise exception using errcode = 'P0001', message = 'The return inspection can only be recorded while the rental is active.';
  end if;
  if p_phase = 'pickup' and not p_plate_confirmed then
    raise exception using errcode = 'P0001', message = 'Confirm that the number plate matches the listing.';
  end if;
  if p_phase = 'pickup' and b.rental_mode = 'self_drive'
    and coalesce(p_checklist ->> 'documents_present', 'false') <> 'true' then
    raise exception using errcode = 'P0001', message = 'Inspect the renter original driving licence and required permit before handover.';
  end if;

  listed_deposit := coalesce(b.deposit_lkr, 0);
  if p_phase = 'pickup' and listed_deposit > 0 then
    if not p_deposit_received then
      raise exception using errcode = 'P0001', message = 'Record the security deposit before submitting the pickup inspection.';
    end if;
    if p_deposit_method not in ('cash', 'bank_transfer', 'other') then
      raise exception using errcode = 'P0001', message = 'Select how the deposit was received.';
    end if;
  end if;

  if p_phase = 'return' and b.deposit_received_at is not null then
    if p_deposit_return_amount is null or p_deposit_return_amount < 0 or p_deposit_return_amount > listed_deposit then
      raise exception using errcode = 'P0001', message = 'Enter a valid deposit return amount.';
    end if;
    if p_deposit_return_amount < listed_deposit and nullif(btrim(coalesce(p_deposit_return_reason, '')), '') is null then
      raise exception using errcode = 'P0001', message = 'Explain why part of the deposit is being withheld.';
    end if;
  end if;

  select * into existing
  from public.booking_inspections
  where booking_id = b.id and phase = p_phase
  for update;
  if found and (existing.renter_ack_at is not null or existing.renter_dispute_note is not null) then
    raise exception using errcode = 'P0001', message = 'The renter already responded to this inspection, so it cannot be edited.';
  end if;

  insert into public.booking_inspections (
    booking_id, phase, submitted_by, odometer_km, fuel_level, plate_confirmed,
    checklist, photo_urls, video_url, notes, renter_ack_at, renter_dispute_note
  ) values (
    b.id, p_phase, p_actor_id, p_odometer_km, p_fuel_level, p_plate_confirmed,
    p_checklist, coalesce(p_photo_urls, '{}'), p_video_url, p_notes, null, null
  )
  on conflict (booking_id, phase) do update set
    submitted_by = excluded.submitted_by,
    odometer_km = excluded.odometer_km,
    fuel_level = excluded.fuel_level,
    plate_confirmed = excluded.plate_confirmed,
    checklist = excluded.checklist,
    photo_urls = excluded.photo_urls,
    video_url = excluded.video_url,
    notes = excluded.notes,
    renter_ack_at = null,
    renter_dispute_note = null,
    updated_at = now_at
  returning * into saved;

  if p_phase = 'pickup' then
    update public.bookings
    set pickup_photo_urls = p_photo_urls,
        deposit_received_at = case when listed_deposit > 0 then now_at else deposit_received_at end,
        deposit_method = case when listed_deposit > 0 then p_deposit_method else deposit_method end,
        deposit_received_ack_at = null
    where id = b.id;
  else
    update public.bookings
    set return_photo_urls = p_photo_urls,
        deposit_returned_at = case when b.deposit_received_at is not null then now_at else deposit_returned_at end,
        deposit_return_amount_lkr = case when b.deposit_received_at is not null then p_deposit_return_amount else deposit_return_amount_lkr end,
        deposit_return_reason = case when b.deposit_received_at is not null then nullif(btrim(coalesce(p_deposit_return_reason, '')), '') else deposit_return_reason end,
        deposit_return_ack_at = null,
        settlement_ack_at = null
    where id = b.id;
  end if;

  return to_jsonb(saved);
end;
$$;

create or replace function public.respond_to_booking_inspection(
  p_booking_id uuid,
  p_renter_id uuid,
  p_phase text,
  p_action text,
  p_note text default null,
  p_deposit_ack boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  inspection public.booking_inspections%rowtype;
  now_at timestamptz := now();
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  incident_id uuid;
begin
  if p_phase not in ('pickup', 'return') or p_action not in ('accept', 'dispute') then
    raise exception using errcode = 'P0001', message = 'Invalid inspection response.';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;
  if b.renter_id <> p_renter_id then
    raise exception using errcode = '42501', message = 'This is not your booking.';
  end if;
  if (p_phase = 'pickup' and b.status::text <> 'confirmed')
    or (p_phase = 'return' and b.status::text <> 'active') then
    raise exception using errcode = 'P0001', message = 'This inspection is no longer awaiting your response.';
  end if;

  select * into inspection
  from public.booking_inspections
  where booking_id = b.id and phase = p_phase
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'No inspection is ready for review.';
  end if;
  if inspection.renter_ack_at is not null or inspection.renter_dispute_note is not null then
    raise exception using errcode = 'P0001', message = 'You already responded to this inspection.';
  end if;

  if p_action = 'accept' then
    if p_phase = 'pickup' and coalesce(b.deposit_lkr, 0) > 0 then
      if b.deposit_received_at is null then
        raise exception using errcode = 'P0001', message = 'The Rental Page has not recorded the security deposit yet.';
      end if;
      if not p_deposit_ack then
        raise exception using errcode = 'P0001', message = 'Confirm the security deposit payment before approving pickup.';
      end if;
    end if;
    if p_phase = 'return' and b.deposit_received_at is not null then
      if b.deposit_returned_at is null then
        raise exception using errcode = 'P0001', message = 'The Rental Page has not recorded the deposit return yet.';
      end if;
      if not p_deposit_ack then
        raise exception using errcode = 'P0001', message = 'Confirm the deposit return before approving the return inspection.';
      end if;
    end if;

    update public.booking_inspections
    set renter_ack_at = now_at
    where id = inspection.id;

    if p_phase = 'pickup' and coalesce(b.deposit_lkr, 0) > 0 then
      update public.bookings set deposit_received_ack_at = now_at where id = b.id;
    elsif p_phase = 'return' and b.deposit_received_at is not null then
      update public.bookings set deposit_return_ack_at = now_at where id = b.id;
    end if;

    return jsonb_build_object('ok', true, 'newStatus', b.status::text);
  end if;

  if clean_note is null or length(clean_note) < 10 then
    raise exception using errcode = 'P0001', message = 'Describe the difference in at least 10 characters.';
  end if;
  if exists (
    select 1 from public.incidents
    where booking_id = b.id and status in ('open', 'awaiting_response', 'escalated')
  ) then
    raise exception using errcode = 'P0001', message = 'A DriveLink review is already open for this booking.';
  end if;

  update public.booking_inspections
  set renter_dispute_note = clean_note
  where id = inspection.id;

  insert into public.incidents (
    booking_id, filed_by, filed_by_side, type, status, description
  ) values (
    b.id, p_renter_id, 'renter',
    case when p_phase = 'pickup' then 'vehicle_mismatch'::public.incident_type else 'damage_claim'::public.incident_type end,
    'open', clean_note
  ) returning id into incident_id;

  update public.bookings
  set status = 'disputed', dispute_reason = clean_note
  where id = b.id;

  return jsonb_build_object('ok', true, 'newStatus', 'disputed', 'incidentId', incident_id);
end;
$$;

create or replace function public.open_booking_dispute(
  p_booking_id uuid,
  p_actor_id uuid,
  p_filed_by_side text,
  p_type text,
  p_reason text,
  p_amount_lkr integer default null,
  p_photo_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  is_page_actor boolean := false;
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  incident_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;

  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;

  if not ((b.renter_id = p_actor_id and p_filed_by_side = 'renter') or (is_page_actor and p_filed_by_side = 'page')) then
    raise exception using errcode = '42501', message = 'You cannot report a problem on this booking.';
  end if;
  if clean_reason is null or length(clean_reason) < 10 then
    raise exception using errcode = 'P0001', message = 'Describe the problem in at least 10 characters.';
  end if;
  if b.status::text = 'completed' then
    if b.completed_at is null or b.completed_at < now() - interval '72 hours' then
      raise exception using errcode = 'P0001', message = 'The 72-hour post-return claim window has closed.';
    end if;
  elsif b.status::text <> 'active' then
    raise exception using errcode = 'P0001', message = 'Problems can be reported during the rental or within 72 hours after completion.';
  end if;
  if exists (
    select 1 from public.incidents
    where booking_id = b.id and status in ('open', 'awaiting_response', 'escalated')
  ) then
    raise exception using errcode = 'P0001', message = 'A DriveLink review is already open for this booking.';
  end if;

  insert into public.incidents (
    booking_id, filed_by, filed_by_side, type, status, description, amount_lkr, photo_urls
  ) values (
    b.id, p_actor_id, p_filed_by_side, p_type::public.incident_type, 'open',
    clean_reason, p_amount_lkr, coalesce(p_photo_urls, '{}')
  ) returning id into incident_id;

  update public.bookings
  set status = 'disputed', dispute_reason = clean_reason
  where id = b.id;

  return jsonb_build_object('ok', true, 'newStatus', 'disputed', 'incidentId', incident_id);
end;
$$;

create or replace function public.accept_booking_settlement(
  p_booking_id uuid,
  p_renter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  return_report public.booking_inspections%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;
  if b.renter_id <> p_renter_id then
    raise exception using errcode = '42501', message = 'This is not your booking.';
  end if;
  if b.status::text <> 'active' then
    raise exception using errcode = 'P0001', message = 'The final settlement is only available during return close-out.';
  end if;
  if b.renter_returned_at is null then
    raise exception using errcode = 'P0001', message = 'Mark the vehicle returned before accepting the final settlement.';
  end if;

  select * into return_report
  from public.booking_inspections
  where booking_id = b.id and phase = 'return'
  for update;
  if not found or return_report.renter_ack_at is null or return_report.renter_dispute_note is not null then
    raise exception using errcode = 'P0001', message = 'Approve the return inspection before accepting the final settlement.';
  end if;
  if b.deposit_received_at is not null and b.deposit_return_ack_at is null then
    raise exception using errcode = 'P0001', message = 'Confirm the deposit return before accepting the final settlement.';
  end if;
  if exists (
    select 1 from public.incidents
    where booking_id = b.id and status in ('open', 'awaiting_response', 'escalated')
  ) then
    raise exception using errcode = 'P0001', message = 'The open DriveLink review must be resolved before settlement.';
  end if;
  if b.settlement_ack_at is not null then
    raise exception using errcode = 'P0001', message = 'You already accepted this settlement.';
  end if;

  update public.bookings set settlement_ack_at = now() where id = b.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.add_booking_charge(
  p_booking_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_label text,
  p_amount_lkr integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  is_page_actor boolean := false;
  inserted public.booking_charges%rowtype;
  clean_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  if p_kind not in ('extra_km','fuel','late','cleaning','damage','delivery','driver','toll','other') then
    raise exception using errcode = 'P0001', message = 'Select a valid charge type.';
  end if;
  if p_amount_lkr is null or p_amount_lkr <= 0 or p_amount_lkr > 100000000 then
    raise exception using errcode = 'P0001', message = 'Enter a valid charge amount.';
  end if;
  if p_kind = 'other' and clean_label is null then
    raise exception using errcode = 'P0001', message = 'Explain what the other charge is for.';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;
  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if not is_page_actor then
    raise exception using errcode = '42501', message = 'Only the Rental Page can add return charges.';
  end if;
  if b.status::text <> 'active' then
    raise exception using errcode = 'P0001', message = 'Charges can only be prepared during return close-out.';
  end if;
  if b.settlement_ack_at is not null then
    raise exception using errcode = 'P0001', message = 'The renter already accepted this settlement, so it is locked.';
  end if;
  if not exists (
    select 1 from public.booking_inspections
    where booking_id = b.id and phase = 'return'
  ) then
    raise exception using errcode = 'P0001', message = 'Record the return inspection before adding final charges.';
  end if;
  if exists (
    select 1 from public.incidents
    where booking_id = b.id and status in ('open', 'awaiting_response', 'escalated')
  ) then
    raise exception using errcode = 'P0001', message = 'Charges are locked while DriveLink reviews an open problem.';
  end if;

  insert into public.booking_charges (booking_id, kind, label, amount_lkr, created_by)
  values (b.id, p_kind, clean_label, p_amount_lkr, p_actor_id)
  returning * into inserted;
  return to_jsonb(inserted);
end;
$$;

create or replace function public.delete_booking_charge(
  p_booking_id uuid,
  p_charge_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  is_page_actor boolean := false;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;
  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if not is_page_actor then
    raise exception using errcode = '42501', message = 'Only the Rental Page can edit return charges.';
  end if;
  if b.status::text <> 'active' or b.settlement_ack_at is not null then
    raise exception using errcode = 'P0001', message = 'This settlement is locked.';
  end if;

  delete from public.booking_charges where id = p_charge_id and booking_id = b.id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Charge not found.';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.transition_booking_lifecycle(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.save_booking_inspection(uuid, uuid, text, integer, text, boolean, jsonb, text[], text, text, boolean, text, integer, text) from public, anon, authenticated;
revoke all on function public.respond_to_booking_inspection(uuid, uuid, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.open_booking_dispute(uuid, uuid, text, text, text, integer, text[]) from public, anon, authenticated;
revoke all on function public.accept_booking_settlement(uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_booking_charge(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.delete_booking_charge(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.transition_booking_lifecycle(uuid, uuid, text, text) to service_role;
grant execute on function public.save_booking_inspection(uuid, uuid, text, integer, text, boolean, jsonb, text[], text, text, boolean, text, integer, text) to service_role;
grant execute on function public.respond_to_booking_inspection(uuid, uuid, text, text, text, boolean) to service_role;
grant execute on function public.open_booking_dispute(uuid, uuid, text, text, text, integer, text[]) to service_role;
grant execute on function public.accept_booking_settlement(uuid, uuid) to service_role;
grant execute on function public.add_booking_charge(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.delete_booking_charge(uuid, uuid, uuid) to service_role;
