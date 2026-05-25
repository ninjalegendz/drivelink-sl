-- ============================================================
-- Vehicle availability — pending bookings block, plus agency-managed
-- maintenance / off-roster periods
-- ============================================================
-- Two changes:
--   1. Calendar/conflict checks treat ANY in-flight booking as blocking
--      (requested + pending_confirmation, on top of the existing
--      confirmed/payment_pending/active). Pending request only frees
--      the slot when the booking moves to declined/cancelled.
--   2. New `vehicle_blocks` table for agency-side unavailable periods
--      (maintenance, owner using the car, etc). Public can read so the
--      renter calendar can grey out the dates; only the agency owner
--      can mutate their own vehicle's blocks.
-- ============================================================

create table if not exists vehicle_blocks (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references vehicles(id) on delete cascade,
  agency_id   uuid not null references agencies(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint vehicle_blocks_date_order check (end_date > start_date)
);

create index if not exists idx_vehicle_blocks_vehicle on vehicle_blocks(vehicle_id, start_date);

alter table vehicle_blocks enable row level security;

-- Anyone can read blocks (calendar display on the public listing page)
drop policy if exists "Public can read vehicle blocks" on vehicle_blocks;
create policy "Public can read vehicle blocks"
  on vehicle_blocks for select using (true);

-- Only the owning agency can write
drop policy if exists "Agency owner manages own blocks" on vehicle_blocks;
create policy "Agency owner manages own blocks"
  on vehicle_blocks for all using (
    agency_id in (select id from agencies where owner_id = auth.uid())
  );

grant select on vehicle_blocks to anon, authenticated;
