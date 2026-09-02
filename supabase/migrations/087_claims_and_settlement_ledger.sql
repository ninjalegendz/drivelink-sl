-- 087 - Evidence-backed return charges, direct-payment proof, and case desk.
--
-- Production had no charge, incident, or accepted-settlement rows before this
-- migration. The changes are still additive so preview/test environments keep
-- their historical rows while all new writes use the stricter functions.

alter table public.booking_charges
  add column if not exists status text not null default 'proposed',
  add column if not exists approved_amount_lkr integer,
  add column if not exists evidence_urls text[] not null default '{}',
  add column if not exists basis jsonb not null default '{}'::jsonb,
  add column if not exists renter_response_note text,
  add column if not exists renter_responded_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.booking_charges drop constraint if exists booking_charges_status_check;
alter table public.booking_charges add constraint booking_charges_status_check
  check (status in ('proposed', 'accepted', 'disputed', 'waived'));
alter table public.booking_charges drop constraint if exists booking_charges_approved_amount_check;
alter table public.booking_charges add constraint booking_charges_approved_amount_check
  check (approved_amount_lkr is null or approved_amount_lkr between 0 and amount_lkr);

create index if not exists idx_booking_charges_status
  on public.booking_charges (booking_id, status);

drop trigger if exists trg_booking_charges_updated_at on public.booking_charges;
create trigger trg_booking_charges_updated_at
  before update on public.booking_charges
  for each row execute function public.set_updated_at();

alter table public.bookings
  add column if not exists deposit_return_method text,
  add column if not exists deposit_return_evidence_urls text[] not null default '{}',
  add column if not exists settlement_charges_total_lkr integer,
  add column if not exists settlement_deposit_retained_lkr integer,
  add column if not exists settlement_outstanding_lkr integer,
  add column if not exists settlement_snapshot jsonb;

alter table public.bookings drop constraint if exists bookings_deposit_return_method_check;
alter table public.bookings add constraint bookings_deposit_return_method_check
  check (deposit_return_method is null or deposit_return_method in ('cash', 'bank_transfer', 'other'));

create table if not exists public.booking_settlement_payments (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null unique references public.bookings(id) on delete cascade,
  direction             text not null check (direction in ('renter_to_page', 'page_to_renter')),
  amount_lkr            integer not null check (amount_lkr > 0),
  method                text not null check (method in ('cash', 'bank_transfer', 'other')),
  note                  text not null,
  evidence_urls         text[] not null default '{}',
  payer_confirmed_by    uuid not null references public.profiles(id),
  payer_confirmed_at    timestamptz not null default now(),
  receiver_confirmed_by uuid references public.profiles(id),
  receiver_confirmed_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_booking_settlement_payments_updated_at on public.booking_settlement_payments;
create trigger trg_booking_settlement_payments_updated_at
  before update on public.booking_settlement_payments
  for each row execute function public.set_updated_at();

alter table public.incidents
  add column if not exists related_charge_id uuid references public.booking_charges(id),
  add column if not exists booking_status_before text,
  add column if not exists claim_deadline_at timestamptz,
  add column if not exists assigned_to uuid references public.profiles(id),
  add column if not exists assigned_at timestamptz,
  add column if not exists decision_checklist jsonb not null default '{}'::jsonb,
  add column if not exists deposit_decision_amount_lkr integer,
  add column if not exists deposit_decision_note text,
  add column if not exists account_action text,
  add column if not exists resolution_code text;

alter table public.incidents drop constraint if exists incidents_account_action_check;
alter table public.incidents add constraint incidents_account_action_check
  check (account_action is null or account_action in ('none', 'warning', 'freeze', 'unfreeze'));
alter table public.incidents drop constraint if exists incidents_resolution_code_check;
alter table public.incidents add constraint incidents_resolution_code_check
  check (resolution_code is null or resolution_code in ('restore', 'cancelled', 'dismissed'));

create table if not exists public.incident_responses (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references public.incidents(id) on delete cascade,
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  author_side   text not null check (author_side in ('renter', 'page')),
  body          text not null check (char_length(body) between 10 and 3000),
  evidence_urls text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists idx_incident_responses_case
  on public.incident_responses (incident_id, created_at);

alter table public.booking_settlement_payments enable row level security;
alter table public.incident_responses enable row level security;

drop policy if exists "Booking parties read settlement payments" on public.booking_settlement_payments;
create policy "Booking parties read settlement payments"
  on public.booking_settlement_payments for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_settlement_payments.booking_id
        and (
          b.renter_id = auth.uid()
          or exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = auth.uid())
          or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = auth.uid())
        )
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Booking parties read case responses" on public.incident_responses;
create policy "Booking parties read case responses"
  on public.incident_responses for select using (
    exists (
      select 1 from public.bookings b
      where b.id = incident_responses.booking_id
        and (
          b.renter_id = auth.uid()
          or exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = auth.uid())
          or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = auth.uid())
        )
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select on public.booking_settlement_payments, public.incident_responses to authenticated;
revoke insert, update, delete on public.booking_settlement_payments, public.incident_responses from anon, authenticated;

-- Every case remembers which real booking stage it interrupted. This works for
-- inspection disputes as well as the general report route.
create or replace function public.set_incident_booking_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.booking_status_before is null then
    select b.status::text into new.booking_status_before
    from public.bookings b where b.id = new.booking_id;
  end if;
  if new.response_due_at is null then
    new.response_due_at := now() + interval '48 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_incident_booking_context on public.incidents;
create trigger trg_incident_booking_context
  before insert on public.incidents
  for each row execute function public.set_incident_booking_context();

-- Replace the return-inspection write so deposit movement has method and proof,
-- not only an amount typed by the provider.
drop function if exists public.save_booking_inspection(
  uuid, uuid, text, integer, text, boolean, jsonb, text[], text, text,
  boolean, text, integer, text
);
drop function if exists public.save_booking_inspection(
  uuid, uuid, text, integer, text, boolean, jsonb, text[], text, text,
  boolean, text, integer, text, text, text[]
);

create function public.save_booking_inspection(
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
  p_deposit_return_reason text default null,
  p_deposit_return_method text default null,
  p_deposit_return_evidence_urls text[] default '{}'
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
    if p_deposit_return_method not in ('cash', 'bank_transfer', 'other') then
      raise exception using errcode = 'P0001', message = 'Select how the deposit was returned.';
    end if;
    if p_deposit_return_method = 'bank_transfer' and coalesce(cardinality(p_deposit_return_evidence_urls), 0) = 0 then
      raise exception using errcode = 'P0001', message = 'Attach the bank-transfer receipt for the deposit return.';
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
        deposit_return_method = case when b.deposit_received_at is not null then p_deposit_return_method else deposit_return_method end,
        deposit_return_evidence_urls = case when b.deposit_received_at is not null then coalesce(p_deposit_return_evidence_urls, '{}') else deposit_return_evidence_urls end,
        deposit_return_ack_at = null,
        settlement_ack_at = null,
        settlement_charges_total_lkr = null,
        settlement_deposit_retained_lkr = null,
        settlement_outstanding_lkr = null,
        settlement_snapshot = null
    where id = b.id;
  end if;

  return to_jsonb(saved);
end;
$$;

-- Providers may only propose a return item backed by the frozen agreement and
-- the two inspection records. Damage, toll/fine, delivery, driver, and open
-- "other" amounts belong in a case or the original booking terms, not here.
drop function if exists public.add_booking_charge(uuid, uuid, text, text, integer);

create or replace function public.add_booking_charge(
  p_booking_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_label text,
  p_amount_lkr integer,
  p_evidence_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  pickup public.booking_inspections%rowtype;
  return_report public.booking_inspections%rowtype;
  terms jsonb;
  is_page_actor boolean := false;
  max_amount integer := 0;
  included_km integer := 0;
  driven_km integer := 0;
  extra_km integer := 0;
  unit_rate integer := 0;
  late_hours integer := 0;
  fuel_pickup integer := 0;
  fuel_return integer := 0;
  basis_data jsonb := '{}'::jsonb;
  inserted public.booking_charges%rowtype;
begin
  if p_kind not in ('extra_km', 'fuel', 'late', 'cleaning') then
    raise exception using errcode = 'P0001', message = 'That item cannot be added to a return settlement. Use a DriveLink case instead.';
  end if;
  if p_amount_lkr is null or p_amount_lkr <= 0 then
    raise exception using errcode = 'P0001', message = 'Enter an amount above zero.';
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
    raise exception using errcode = '42501', message = 'Only the Rental Page can propose a return item.';
  end if;
  if b.status::text <> 'active' then
    raise exception using errcode = 'P0001', message = 'Return items can only be prepared while the rental is being closed.';
  end if;
  if b.settlement_ack_at is not null then
    raise exception using errcode = 'P0001', message = 'The accepted settlement is locked.';
  end if;
  if exists (
    select 1 from public.incidents i
    where i.booking_id = b.id and i.status in ('open', 'awaiting_response', 'escalated')
  ) then
    raise exception using errcode = 'P0001', message = 'Resolve the open DriveLink case before changing return items.';
  end if;
  if exists (
    select 1 from public.booking_charges c
    where c.booking_id = b.id and c.kind = p_kind and c.status <> 'waived'
  ) then
    raise exception using errcode = 'P0001', message = 'That return item has already been added.';
  end if;

  select * into pickup from public.booking_inspections
  where booking_id = b.id and phase = 'pickup';
  select * into return_report from public.booking_inspections
  where booking_id = b.id and phase = 'return';
  if pickup.id is null or return_report.id is null then
    raise exception using errcode = 'P0001', message = 'Both pickup and return inspections are required before adding return items.';
  end if;
  if b.renter_returned_at is null then
    raise exception using errcode = 'P0001', message = 'The renter must mark the vehicle returned before return items are proposed.';
  end if;

  select a.terms into terms from public.booking_agreements a where a.booking_id = b.id;
  if terms is null then
    raise exception using errcode = 'P0001', message = 'The signed agreement terms are missing, so DriveLink cannot calculate a safe maximum.';
  end if;

  if p_kind = 'extra_km' then
    if coalesce((terms #>> '{mileage,unlimited}')::boolean, false) then
      raise exception using errcode = 'P0001', message = 'The signed agreement includes unlimited kilometres.';
    end if;
    included_km := coalesce(nullif(terms #>> '{mileage,included_km_per_day}', '')::integer, 0) * greatest(b.total_days, 1);
    unit_rate := coalesce(nullif(terms #>> '{mileage,extra_km_rate_lkr}', '')::integer, 0);
    driven_km := greatest(coalesce(return_report.odometer_km, 0) - coalesce(pickup.odometer_km, 0), 0);
    extra_km := greatest(driven_km - included_km, 0);
    max_amount := extra_km * unit_rate;
    basis_data := jsonb_build_object(
      'pickup_odometer_km', pickup.odometer_km,
      'return_odometer_km', return_report.odometer_km,
      'driven_km', driven_km,
      'included_km', included_km,
      'chargeable_km', extra_km,
      'rate_lkr_per_km', unit_rate,
      'maximum_lkr', max_amount
    );
  elsif p_kind = 'late' then
    unit_rate := coalesce(
      nullif(terms #>> '{fees,late_fee_per_hour_lkr}', '')::integer,
      ceil(b.daily_rate_lkr::numeric / 8)::integer
    );
    late_hours := greatest(ceil(extract(epoch from (b.renter_returned_at - (b.end_at + interval '2 hours'))) / 3600)::integer, 0);
    max_amount := least(late_hours * unit_rate, b.daily_rate_lkr);
    basis_data := jsonb_build_object(
      'scheduled_return_at', b.end_at,
      'actual_return_at', b.renter_returned_at,
      'grace_hours', 2,
      'chargeable_hours', late_hours,
      'rate_lkr_per_hour', unit_rate,
      'daily_rate_cap_lkr', b.daily_rate_lkr,
      'maximum_lkr', max_amount
    );
  elsif p_kind = 'cleaning' then
    max_amount := coalesce(nullif(terms #>> '{fees,cleaning_fee_lkr}', '')::integer, 0);
    if coalesce(cardinality(p_evidence_urls), 0) = 0 or char_length(btrim(coalesce(p_label, ''))) < 10 then
      raise exception using errcode = 'P0001', message = 'Add a clear cleaning explanation and at least one return photo.';
    end if;
    basis_data := jsonb_build_object('agreement_cap_lkr', max_amount, 'evidence_count', cardinality(p_evidence_urls));
  elsif p_kind = 'fuel' then
    fuel_pickup := case pickup.fuel_level when 'empty' then 0 when 'quarter' then 1 when 'half' then 2 when 'three_quarter' then 3 when 'full' then 4 else 0 end;
    fuel_return := case return_report.fuel_level when 'empty' then 0 when 'quarter' then 1 when 'half' then 2 when 'three_quarter' then 3 when 'full' then 4 else 0 end;
    if fuel_return >= fuel_pickup then
      raise exception using errcode = 'P0001', message = 'The return inspection does not show a lower fuel level.';
    end if;
    max_amount := coalesce(nullif(terms #>> '{fuel,refuel_fee_lkr}', '')::integer, 0);
    if coalesce(cardinality(p_evidence_urls), 0) = 0 or char_length(btrim(coalesce(p_label, ''))) < 10 then
      raise exception using errcode = 'P0001', message = 'Add a clear fuel explanation and the receipt or return evidence.';
    end if;
    basis_data := jsonb_build_object(
      'pickup_fuel_level', pickup.fuel_level,
      'return_fuel_level', return_report.fuel_level,
      'agreement_refuel_fee_cap_lkr', max_amount,
      'evidence_count', cardinality(p_evidence_urls)
    );
  end if;

  if max_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'The signed terms and inspection record calculate no amount for this item.';
  end if;
  if p_amount_lkr > max_amount then
    raise exception using errcode = 'P0001', message = format('The maximum supported by the signed terms is Rs. %s.', max_amount);
  end if;

  insert into public.booking_charges (
    booking_id, kind, label, amount_lkr, created_by, status, evidence_urls, basis
  ) values (
    b.id, p_kind, nullif(btrim(coalesce(p_label, '')), ''), p_amount_lkr, p_actor_id,
    'proposed', coalesce(p_evidence_urls, '{}'), basis_data
  ) returning * into inserted;

  return to_jsonb(inserted);
end;
$$;

-- Claim clocks are decided from the frozen booking record, not trusted from a
-- browser. Fines and toll notices have the signed 30-day window; other
-- post-return reports have 72 hours. Evidence-heavy claims fail closed.
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
  deadline timestamptz;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;

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
  if p_type in ('fine_received', 'toll_claim') and p_filed_by_side <> 'page' then
    raise exception using errcode = 'P0001', message = 'Only the Rental Page can file a fine or toll notice.';
  end if;
  if p_type in ('fine_received', 'toll_claim') and coalesce(p_amount_lkr, 0) <= 0 then
    raise exception using errcode = 'P0001', message = 'Enter the amount shown on the fine or toll notice.';
  end if;
  if p_type in ('damage_claim', 'fine_received', 'toll_claim', 'lost_item')
    and coalesce(cardinality(p_photo_urls), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Attach at least one supporting photo, receipt, estimate, or official notice.';
  end if;

  if b.status::text = 'completed' then
    if b.completed_at is null then raise exception using errcode = 'P0001', message = 'The completion time is missing.'; end if;
    deadline := case
      when p_type in ('fine_received', 'toll_claim') and p_filed_by_side = 'page'
        then b.completed_at + interval '30 days'
      else b.completed_at + interval '72 hours'
    end;
    if now() > deadline then
      raise exception using errcode = 'P0001', message = case
        when p_type in ('fine_received', 'toll_claim') then 'The 30-day fine and toll claim window has closed.'
        else 'The 72-hour post-return claim window has closed.'
      end;
    end if;
  elsif b.status::text <> 'active' then
    raise exception using errcode = 'P0001', message = 'Problems can be reported during the rental or within the deadline shown after completion.';
  end if;
  if exists (
    select 1 from public.incidents i
    where i.booking_id = b.id and i.status in ('open', 'awaiting_response', 'escalated')
  ) then raise exception using errcode = 'P0001', message = 'A DriveLink review is already open for this booking.';
  end if;

  insert into public.incidents (
    booking_id, filed_by, filed_by_side, type, status, description, amount_lkr,
    photo_urls, evidence_urls, booking_status_before, claim_deadline_at
  ) values (
    b.id, p_actor_id, p_filed_by_side, p_type::public.incident_type, 'open',
    clean_reason, p_amount_lkr, coalesce(p_photo_urls, '{}'), coalesce(p_photo_urls, '{}'),
    b.status::text, deadline
  ) returning id into incident_id;

  update public.bookings set status = 'disputed', dispute_reason = clean_reason where id = b.id;
  return jsonb_build_object('ok', true, 'newStatus', 'disputed', 'incidentId', incident_id, 'claimDeadlineAt', deadline);
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
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if not is_page_actor then raise exception using errcode = '42501', message = 'Only the Rental Page can edit return items.'; end if;
  if b.status::text <> 'active' or b.settlement_ack_at is not null then
    raise exception using errcode = 'P0001', message = 'This settlement is locked.';
  end if;

  delete from public.booking_charges
  where id = p_charge_id and booking_id = b.id and status = 'proposed';
  if not found then
    raise exception using errcode = 'P0001', message = 'Only an unanswered proposed item can be removed.';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.respond_to_booking_charge(
  p_booking_id uuid,
  p_charge_id uuid,
  p_renter_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  charge public.booking_charges%rowtype;
  incident_id uuid;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_action not in ('accept', 'dispute') then
    raise exception using errcode = 'P0001', message = 'Choose accept or dispute.';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  if b.renter_id <> p_renter_id then raise exception using errcode = '42501', message = 'Only the renter can answer this item.'; end if;
  if b.status::text not in ('active', 'disputed') then
    raise exception using errcode = 'P0001', message = 'Return items can only be answered during return close-out.';
  end if;
  if b.settlement_ack_at is not null then raise exception using errcode = 'P0001', message = 'The accepted settlement is locked.'; end if;

  select * into charge from public.booking_charges
  where id = p_charge_id and booking_id = b.id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Return item not found.'; end if;
  if charge.status <> 'proposed' then raise exception using errcode = 'P0001', message = 'You already answered this item.'; end if;

  if p_action = 'accept' then
    update public.booking_charges
    set status = 'accepted', approved_amount_lkr = amount_lkr,
        renter_response_note = clean_note, renter_responded_at = now()
    where id = charge.id;
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;

  if clean_note is null or char_length(clean_note) < 10 then
    raise exception using errcode = 'P0001', message = 'Explain what is wrong with this item in at least 10 characters.';
  end if;
  update public.booking_charges
  set status = 'disputed', renter_response_note = clean_note, renter_responded_at = now()
  where id = charge.id;

  select i.id into incident_id from public.incidents i
  where i.booking_id = b.id and i.status in ('open', 'awaiting_response', 'escalated')
  order by i.created_at limit 1 for update;

  if incident_id is null then
    insert into public.incidents (
      booking_id, filed_by, filed_by_side, type, status, description,
      amount_lkr, related_charge_id, booking_status_before
    ) values (
      b.id, p_renter_id, 'renter', 'other', 'open',
      'Return item disputed: ' || coalesce(charge.label, charge.kind) || E'\n' || clean_note,
      charge.amount_lkr, charge.id, b.status::text
    ) returning id into incident_id;
  end if;

  if b.status::text = 'active' then
    update public.bookings set status = 'disputed', dispute_reason = clean_note where id = b.id;
  end if;
  return jsonb_build_object('ok', true, 'status', 'disputed', 'incidentId', incident_id);
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
  charges_total integer := 0;
  deposit_held integer := 0;
  deposit_returned integer := 0;
  deposit_retained integer := 0;
  outstanding integer := 0;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  if b.renter_id <> p_renter_id then raise exception using errcode = '42501', message = 'Only the renter can accept the settlement.'; end if;
  if b.status::text <> 'active' then raise exception using errcode = 'P0001', message = 'The final settlement is only available during return close-out.'; end if;
  if b.renter_returned_at is null then raise exception using errcode = 'P0001', message = 'Mark the vehicle returned before accepting the final settlement.'; end if;

  select * into return_report from public.booking_inspections
  where booking_id = b.id and phase = 'return' for update;
  if not found or return_report.renter_ack_at is null or return_report.renter_dispute_note is not null then
    raise exception using errcode = 'P0001', message = 'Approve the return inspection before accepting the final settlement.';
  end if;
  if b.deposit_received_at is not null and b.deposit_return_ack_at is null then
    raise exception using errcode = 'P0001', message = 'Confirm the deposit return before accepting the final settlement.';
  end if;
  if exists (select 1 from public.incidents i where i.booking_id = b.id and i.status in ('open', 'awaiting_response', 'escalated')) then
    raise exception using errcode = 'P0001', message = 'The open DriveLink case must be resolved before settlement.';
  end if;
  if exists (select 1 from public.booking_charges c where c.booking_id = b.id and c.status in ('proposed', 'disputed')) then
    raise exception using errcode = 'P0001', message = 'Answer every return item before accepting the final settlement.';
  end if;
  if b.settlement_ack_at is not null then raise exception using errcode = 'P0001', message = 'You already accepted this settlement.'; end if;

  select coalesce(sum(coalesce(c.approved_amount_lkr, c.amount_lkr)), 0)::integer into charges_total
  from public.booking_charges c where c.booking_id = b.id and c.status = 'accepted';
  deposit_held := case when b.deposit_received_at is not null then coalesce(b.deposit_lkr, 0) else 0 end;
  deposit_returned := case when b.deposit_return_ack_at is not null then coalesce(b.deposit_return_amount_lkr, 0) else 0 end;
  deposit_retained := greatest(deposit_held - deposit_returned, 0);
  outstanding := charges_total - deposit_retained;

  update public.bookings
  set settlement_ack_at = now(),
      settlement_charges_total_lkr = charges_total,
      settlement_deposit_retained_lkr = deposit_retained,
      settlement_outstanding_lkr = outstanding,
      settlement_snapshot = jsonb_build_object(
        'charges_total_lkr', charges_total,
        'deposit_held_lkr', deposit_held,
        'deposit_returned_lkr', deposit_returned,
        'deposit_retained_lkr', deposit_retained,
        'outstanding_lkr', outstanding,
        'accepted_at', now()
      )
  where id = b.id;

  return jsonb_build_object('ok', true, 'chargesTotalLkr', charges_total, 'depositRetainedLkr', deposit_retained, 'outstandingLkr', outstanding);
end;
$$;

create or replace function public.record_booking_settlement_payment(
  p_booking_id uuid,
  p_actor_id uuid,
  p_method text,
  p_note text,
  p_evidence_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  is_page_actor boolean := false;
  expected_direction text;
  expected_amount integer;
  payment public.booking_settlement_payments%rowtype;
begin
  if p_method not in ('cash', 'bank_transfer', 'other') then raise exception using errcode = 'P0001', message = 'Select a payment method.'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception using errcode = 'P0001', message = 'Add a short payment reference or cash note.'; end if;
  if p_method = 'bank_transfer' and coalesce(cardinality(p_evidence_urls), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Attach the bank-transfer receipt.';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  if b.status::text <> 'active' or b.settlement_ack_at is null then
    raise exception using errcode = 'P0001', message = 'Accept the final settlement before recording its direct payment.';
  end if;
  if coalesce(b.settlement_outstanding_lkr, 0) = 0 then
    raise exception using errcode = 'P0001', message = 'No further direct payment is required.';
  end if;

  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  expected_direction := case when b.settlement_outstanding_lkr > 0 then 'renter_to_page' else 'page_to_renter' end;
  expected_amount := abs(b.settlement_outstanding_lkr);
  if (expected_direction = 'renter_to_page' and b.renter_id <> p_actor_id)
    or (expected_direction = 'page_to_renter' and not is_page_actor) then
    raise exception using errcode = '42501', message = 'Only the party sending this payment can record it.';
  end if;

  insert into public.booking_settlement_payments (
    booking_id, direction, amount_lkr, method, note, evidence_urls, payer_confirmed_by
  ) values (
    b.id, expected_direction, expected_amount, p_method, btrim(p_note), coalesce(p_evidence_urls, '{}'), p_actor_id
  )
  on conflict (booking_id) do nothing
  returning * into payment;
  if payment.id is null then raise exception using errcode = 'P0001', message = 'This payment has already been recorded.'; end if;
  return to_jsonb(payment);
end;
$$;

create or replace function public.confirm_booking_settlement_payment(
  p_booking_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  payment public.booking_settlement_payments%rowtype;
  is_page_actor boolean := false;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  select * into payment from public.booking_settlement_payments where booking_id = b.id for update;
  if not found then raise exception using errcode = 'P0002', message = 'The sending party has not recorded the payment yet.'; end if;
  if payment.receiver_confirmed_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;

  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if (payment.direction = 'renter_to_page' and not is_page_actor)
    or (payment.direction = 'page_to_renter' and b.renter_id <> p_actor_id) then
    raise exception using errcode = '42501', message = 'Only the receiving party can confirm this payment.';
  end if;

  update public.booking_settlement_payments
  set receiver_confirmed_by = p_actor_id, receiver_confirmed_at = now()
  where id = payment.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- A final database backstop applies even if a future route bypasses the normal
-- transition function. Completion never outruns open items or direct payment.
create or replace function public.guard_booking_completion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status::text = 'completed' and old.status::text is distinct from 'completed' then
    -- A post-completion claim temporarily changes an already completed booking
    -- to disputed. Restoring that prior completed state is not a new handover.
    if old.status::text = 'disputed' and old.completed_at is not null then
      return new;
    end if;
    if new.renter_returned_at is null then raise exception using errcode = 'P0001', message = 'The renter must mark the vehicle returned before completion.'; end if;
    if not exists (
      select 1 from public.booking_inspections i
      where i.booking_id = new.id and i.phase = 'return' and i.renter_ack_at is not null and i.renter_dispute_note is null
    ) then raise exception using errcode = 'P0001', message = 'Both sides must approve the return inspection before completion.'; end if;
    if exists (select 1 from public.booking_charges c where c.booking_id = new.id and c.status in ('proposed', 'disputed')) then
      raise exception using errcode = 'P0001', message = 'Every return item must be decided before completion.';
    end if;
    if exists (select 1 from public.incidents i where i.booking_id = new.id and i.status in ('open', 'awaiting_response', 'escalated')) then
      raise exception using errcode = 'P0001', message = 'The open DriveLink case must be resolved before completion.';
    end if;
    if new.deposit_received_at is not null and (new.deposit_returned_at is null or new.deposit_return_ack_at is null) then
      raise exception using errcode = 'P0001', message = 'Both sides must confirm the deposit return before completion.';
    end if;
    if new.settlement_ack_at is null then raise exception using errcode = 'P0001', message = 'The renter must accept the final settlement before completion.'; end if;
    if coalesce(new.settlement_outstanding_lkr, 0) <> 0 and not exists (
      select 1 from public.booking_settlement_payments p
      where p.booking_id = new.id and p.payer_confirmed_at is not null and p.receiver_confirmed_at is not null
    ) then raise exception using errcode = 'P0001', message = 'Both sides must confirm the final direct payment before completion.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_booking_completion on public.bookings;
create trigger trg_guard_booking_completion
  before update of status on public.bookings
  for each row execute function public.guard_booking_completion();

create or replace function public.add_incident_response(
  p_incident_id uuid,
  p_actor_id uuid,
  p_body text,
  p_evidence_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  incident public.incidents%rowtype;
  b public.bookings%rowtype;
  side text;
  response public.incident_responses%rowtype;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 3000 then
    raise exception using errcode = 'P0001', message = 'Write a response between 10 and 3000 characters.';
  end if;
  select * into incident from public.incidents where id = p_incident_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Case not found.'; end if;
  if incident.status not in ('open', 'awaiting_response', 'escalated') then raise exception using errcode = 'P0001', message = 'This case is closed.'; end if;
  select * into b from public.bookings where id = incident.booking_id;
  if b.renter_id = p_actor_id then side := 'renter';
  elsif exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id) then side := 'page';
  else raise exception using errcode = '42501', message = 'You cannot respond to this case.';
  end if;
  if (select count(*) from public.incident_responses r where r.incident_id = incident.id) >= 12 then
    raise exception using errcode = 'P0001', message = 'This case response thread is full. Continue in booking messages or contact support.';
  end if;

  insert into public.incident_responses (incident_id, booking_id, author_id, author_side, body, evidence_urls)
  values (incident.id, b.id, p_actor_id, side, btrim(p_body), coalesce(p_evidence_urls, '{}'))
  returning * into response;
  update public.incidents set status = 'awaiting_response' where id = incident.id and status = 'open';
  return to_jsonb(response);
end;
$$;

create or replace function public.assign_booking_case(
  p_incident_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare incident public.incidents%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = p_admin_id and p.role = 'admin') then
    raise exception using errcode = '42501', message = 'Admin access required.';
  end if;
  update public.incidents
  set assigned_to = p_admin_id, assigned_at = coalesce(assigned_at, now())
  where id = p_incident_id and status in ('open', 'awaiting_response', 'escalated')
  returning * into incident;
  if incident.id is null then raise exception using errcode = 'P0002', message = 'Open case not found.'; end if;
  return to_jsonb(incident);
end;
$$;

create or replace function public.resolve_booking_case(
  p_incident_id uuid,
  p_admin_id uuid,
  p_resolution_note text,
  p_outcome text,
  p_checklist jsonb,
  p_charge_decisions jsonb default '[]'::jsonb,
  p_deposit_decision_amount integer default null,
  p_deposit_decision_note text default null,
  p_account_action text default 'none'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  incident public.incidents%rowtype;
  b public.bookings%rowtype;
  decision jsonb;
  charge public.booking_charges%rowtype;
  approved integer;
  target_status text;
  clean_note text := btrim(coalesce(p_resolution_note, ''));
begin
  if not exists (select 1 from public.profiles p where p.id = p_admin_id and p.role = 'admin') then
    raise exception using errcode = '42501', message = 'Admin access required.';
  end if;
  if char_length(clean_note) < 10 then raise exception using errcode = 'P0001', message = 'Write a clear resolution of at least 10 characters.'; end if;
  if p_outcome not in ('restore', 'cancelled', 'dismissed') then raise exception using errcode = 'P0001', message = 'Choose a valid case outcome.'; end if;
  if p_account_action not in ('none', 'warning', 'freeze', 'unfreeze') then raise exception using errcode = 'P0001', message = 'Choose a valid account action.'; end if;
  if not (
    coalesce((p_checklist ->> 'evidence_reviewed')::boolean, false)
    and coalesce((p_checklist ->> 'agreement_reviewed')::boolean, false)
    and coalesce((p_checklist ->> 'party_responses_reviewed')::boolean, false)
    and coalesce((p_checklist ->> 'money_decided')::boolean, false)
  ) then raise exception using errcode = 'P0001', message = 'Complete all four decision checks before resolving the case.';
  end if;

  select * into incident from public.incidents where id = p_incident_id for update;
  if not found or incident.status not in ('open', 'awaiting_response', 'escalated') then raise exception using errcode = 'P0002', message = 'Open case not found.'; end if;
  select * into b from public.bookings where id = incident.booking_id for update;

  for decision in select value from jsonb_array_elements(coalesce(p_charge_decisions, '[]'::jsonb)) loop
    select * into charge from public.booking_charges
    where id = (decision ->> 'charge_id')::uuid and booking_id = b.id and status = 'disputed'
    for update;
    if not found then raise exception using errcode = 'P0001', message = 'A charge decision does not match this case.'; end if;
    if decision ->> 'decision' = 'waive' then
      update public.booking_charges set status = 'waived', approved_amount_lkr = 0 where id = charge.id;
    elsif decision ->> 'decision' = 'accept' then
      approved := nullif(decision ->> 'approved_amount_lkr', '')::integer;
      if approved is null or approved < 0 or approved > charge.amount_lkr then
        raise exception using errcode = 'P0001', message = 'Approved charge amount is outside the proposed amount.';
      end if;
      update public.booking_charges
      set status = case when approved = 0 then 'waived' else 'accepted' end,
          approved_amount_lkr = approved
      where id = charge.id;
    else raise exception using errcode = 'P0001', message = 'Choose accept or waive for every disputed charge.';
    end if;
  end loop;

  if exists (select 1 from public.booking_charges c where c.booking_id = b.id and c.status = 'disputed') then
    raise exception using errcode = 'P0001', message = 'Decide every disputed return item before resolving the case.';
  end if;

  target_status := case
    when p_outcome = 'cancelled' then 'cancelled'
    when incident.booking_status_before in ('confirmed', 'active', 'completed') then incident.booking_status_before
    else 'active'
  end;

  update public.incidents
  set status = case when p_outcome = 'dismissed' then 'dismissed'::public.incident_status else 'resolved'::public.incident_status end,
      assigned_to = coalesce(assigned_to, p_admin_id),
      assigned_at = coalesce(assigned_at, now()),
      resolved_by = p_admin_id,
      resolved_at = now(),
      resolution_note = clean_note,
      decision_checklist = p_checklist,
      deposit_decision_amount_lkr = p_deposit_decision_amount,
      deposit_decision_note = nullif(btrim(coalesce(p_deposit_decision_note, '')), ''),
      account_action = p_account_action,
      resolution_code = p_outcome
  where id = incident.id;

  if p_account_action = 'freeze' then update public.profiles set booking_frozen = true where id = b.renter_id;
  elsif p_account_action = 'unfreeze' then update public.profiles set booking_frozen = false where id = b.renter_id;
  end if;

  -- An inspection difference pauses the booking. After an admin decision the
  -- provider must be able to correct and resubmit that inspection, and the
  -- renter must answer the corrected record again.
  update public.booking_inspections
  set renter_dispute_note = null, renter_ack_at = null
  where booking_id = b.id and renter_dispute_note is not null;

  update public.bookings
  set status = target_status::public.booking_status,
      dispute_reason = null,
      completed_at = case when target_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
      cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end,
      cancelled_by = case when target_status = 'cancelled' then 'system' else cancelled_by end,
      cancellation_reason = case when target_status = 'cancelled' then 'Closed by DriveLink after case review: ' || clean_note else cancellation_reason end
  where id = b.id;

  insert into public.activity_events (
    actor_id, actor_role, event_type, subject_kind, subject_id,
    related_renter_id, related_agency_id, related_booking_id, metadata
  ) values (
    p_admin_id, 'admin', 'booking.case_resolved', 'booking', b.id,
    b.renter_id, b.agency_id, b.id,
    jsonb_build_object('incident_id', incident.id, 'outcome', p_outcome, 'restored_status', target_status, 'account_action', p_account_action)
  );

  return jsonb_build_object('ok', true, 'bookingStatus', target_status, 'caseStatus', case when p_outcome = 'dismissed' then 'dismissed' else 'resolved' end);
end;
$$;

-- Service-role-only write surface.
revoke all on function public.save_booking_inspection(uuid, uuid, text, integer, text, boolean, jsonb, text[], text, text, boolean, text, integer, text, text, text[]) from public, anon, authenticated;
revoke all on function public.add_booking_charge(uuid, uuid, text, text, integer, text[]) from public, anon, authenticated;
revoke all on function public.delete_booking_charge(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.respond_to_booking_charge(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.open_booking_dispute(uuid, uuid, text, text, text, integer, text[]) from public, anon, authenticated;
revoke all on function public.accept_booking_settlement(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_booking_settlement_payment(uuid, uuid, text, text, text[]) from public, anon, authenticated;
revoke all on function public.confirm_booking_settlement_payment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_incident_response(uuid, uuid, text, text[]) from public, anon, authenticated;
revoke all on function public.assign_booking_case(uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_booking_case(uuid, uuid, text, text, jsonb, jsonb, integer, text, text) from public, anon, authenticated;

grant execute on function public.save_booking_inspection(uuid, uuid, text, integer, text, boolean, jsonb, text[], text, text, boolean, text, integer, text, text, text[]) to service_role;
grant execute on function public.add_booking_charge(uuid, uuid, text, text, integer, text[]) to service_role;
grant execute on function public.delete_booking_charge(uuid, uuid, uuid) to service_role;
grant execute on function public.respond_to_booking_charge(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.open_booking_dispute(uuid, uuid, text, text, text, integer, text[]) to service_role;
grant execute on function public.accept_booking_settlement(uuid, uuid) to service_role;
grant execute on function public.record_booking_settlement_payment(uuid, uuid, text, text, text[]) to service_role;
grant execute on function public.confirm_booking_settlement_payment(uuid, uuid) to service_role;
grant execute on function public.add_incident_response(uuid, uuid, text, text[]) to service_role;
grant execute on function public.assign_booking_case(uuid, uuid) to service_role;
grant execute on function public.resolve_booking_case(uuid, uuid, text, text, jsonb, jsonb, integer, text, text) to service_role;
