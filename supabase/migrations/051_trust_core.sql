-- ============================================================
-- 051 — Trust core (Phase B): incidents, inspections, agreements,
-- deposit trail, licence capture, document-access log.
--
-- Idempotent. New enums are created and used within this script,
-- which is safe (the enum-in-same-tx rule only bites on ALTER TYPE
-- ADD VALUE followed by use in the same transaction).
-- ============================================================

-- ── Incidents: one pipeline for every mid/post-rental problem ──

do $$ begin
  create type incident_type as enum (
    'accident', 'breakdown', 'late_return', 'no_show', 'damage_claim',
    'fine_received', 'toll_claim', 'lost_item', 'driver_complaint',
    'conduct_violation', 'vehicle_mismatch', 'deposit_violation', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_status as enum (
    'open', 'awaiting_response', 'escalated', 'resolved', 'dismissed'
  );
exception when duplicate_object then null; end $$;

create table if not exists incidents (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings(id),
  filed_by        uuid not null references profiles(id),
  filed_by_side   text not null check (filed_by_side in ('renter', 'page', 'admin')),
  type            incident_type not null,
  status          incident_status not null default 'open',
  description     text not null,
  amount_lkr      integer,              -- claimed amount where applicable (damage, fine, toll)
  photo_urls      text[] not null default '{}',
  evidence_urls   text[] not null default '{}',  -- notices, receipts, estimates
  response_due_at timestamptz,          -- claim clocks (breakdown 4h, damage estimate 48h)
  resolved_by     uuid references profiles(id),
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_incidents_booking on incidents(booking_id);
create index if not exists idx_incidents_status  on incidents(status) where status in ('open', 'awaiting_response', 'escalated');

drop trigger if exists trg_incidents_updated_at on incidents;
create trigger trg_incidents_updated_at
  before update on incidents
  for each row execute function set_updated_at();

-- ── Inspections: the pickup/return condition reports ──

create table if not exists booking_inspections (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id),
  phase               text not null check (phase in ('pickup', 'return')),
  submitted_by        uuid not null references profiles(id),   -- the page side submits
  odometer_km         integer,
  fuel_level          text check (fuel_level in ('empty', 'quarter', 'half', 'three_quarter', 'full')),
  plate_confirmed     boolean not null default false,          -- bait-and-switch defense (pickup)
  checklist           jsonb,                                    -- { documents_present, accessories: [...], ... }
  photo_urls          text[] not null default '{}',
  video_url           text,
  notes               text,
  renter_ack_at       timestamptz,        -- "Everything looks correct"
  renter_dispute_note text,               -- "Report difference"
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (booking_id, phase)
);

drop trigger if exists trg_inspections_updated_at on booking_inspections;
create trigger trg_inspections_updated_at
  before update on booking_inspections
  for each row execute function set_updated_at();

-- ── Digital rental agreement: terms snapshot + both-party acceptance ──

create table if not exists booking_agreements (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid unique not null references bookings(id),
  template_version   text not null default 'v1',
  terms              jsonb not null,     -- full snapshot: vehicle terms, pricing, parties, deposit rules
  renter_accepted_at timestamptz,
  renter_accept_meta jsonb,              -- device info, at-acceptance context
  owner_accepted_at  timestamptz,
  owner_accept_meta  jsonb,
  created_at         timestamptz not null default now()
);

-- ── Deposit trail on bookings (witness, never hold) ──

alter table bookings
  add column if not exists deposit_lkr               integer,     -- snapshot from vehicle at confirmation
  add column if not exists deposit_method            text check (deposit_method in ('cash', 'bank_transfer', 'other')),
  add column if not exists deposit_received_at       timestamptz, -- page marked received at pickup
  add column if not exists deposit_received_ack_at   timestamptz, -- renter confirmed they paid it
  add column if not exists deposit_returned_at       timestamptz,
  add column if not exists deposit_return_amount_lkr integer,
  add column if not exists deposit_return_reason     text,        -- required for partial returns
  add column if not exists deposit_return_ack_at     timestamptz, -- renter confirmed receipt back
  -- late-return ladder markers (set by cron; end_at + grace does the math)
  add column if not exists overdue_notified_at       timestamptz,
  add column if not exists overdue_critical_at       timestamptz,
  -- document-sharing consent (blueprint: explicit, per booking)
  add column if not exists doc_share_consent_at      timestamptz;

-- ── Renter driving licence + booking freeze ──

alter table profiles
  add column if not exists license_front_url text,
  add column if not exists license_back_url  text,
  -- set while a booking is overdue-critical; checked at booking creation
  add column if not exists booking_frozen    boolean not null default false;

-- ── Document access log (PDPA: who viewed what, when) ──

create table if not exists document_access_log (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id),
  viewer_id   uuid not null references profiles(id),
  document    text not null,             -- 'nic' | 'license_front' | 'license_back' | ...
  created_at  timestamptz not null default now()
);

create index if not exists idx_doc_access_booking on document_access_log(booking_id);

-- ── Row level security ──

alter table incidents            enable row level security;
alter table booking_inspections  enable row level security;
alter table booking_agreements   enable row level security;
alter table document_access_log  enable row level security;

-- Shared predicate: the caller is the renter on the booking, or owns
-- the Rental Page the booking belongs to. (Admin goes through the
-- service role / admin policies.)
-- Written inline per policy, Postgres has no policy macros.

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('incidents', 'booking_inspections', 'booking_agreements', 'document_access_log')
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "Booking parties read incidents"
  on incidents for select using (
    exists (
      select 1 from bookings b
      where b.id = incidents.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

create policy "Booking parties file incidents"
  on incidents for insert with check (
    filed_by = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = incidents.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

create policy "Admins manage incidents"
  on incidents for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Booking parties read inspections"
  on booking_inspections for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_inspections.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

create policy "Page side submits inspections"
  on booking_inspections for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = booking_inspections.booking_id
        and b.agency_id in (select id from agencies where owner_id = auth.uid())
    )
  );

-- Renter acks / page-side edits both arrive as updates; RLS allows both
-- parties, the API constrains which columns each side may touch.
create policy "Booking parties update inspections"
  on booking_inspections for update using (
    exists (
      select 1 from bookings b
      where b.id = booking_inspections.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

create policy "Admins manage inspections"
  on booking_inspections for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Booking parties read agreement"
  on booking_agreements for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_agreements.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

-- Agreements are created/accepted through API routes (service role),
-- acceptance stamps need server-side timestamping + meta capture.

create policy "Admins manage agreements"
  on booking_agreements for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Access log: the renter whose documents were viewed may read their
-- own trail (sharing history); writes happen server-side only.
create policy "Renter reads own document access trail"
  on document_access_log for select using (
    exists (
      select 1 from bookings b
      where b.id = document_access_log.booking_id and b.renter_id = auth.uid()
    )
  );

create policy "Admins read document access log"
  on document_access_log for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
