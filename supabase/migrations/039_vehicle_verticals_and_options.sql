-- ============================================================
-- Vehicle verticals + rental options + trust badges
-- ============================================================
-- The marketplace revamp opens DriveLink beyond self-drive cars to a
-- multi-vertical, verified vehicle marketplace: cars, SUVs, vans, bikes
-- and tuk-tuks, offered self-drive / with-driver / airport-pickup, each
-- carrying trust badges and tourist-friendly rules. All additive and
-- idempotent — the existing self-serve + concierge pipelines keep working.
-- ============================================================

-- New enum for the vehicle category. Creating a NEW enum and using it in
-- the same migration is safe (only ADD VALUE to an EXISTING enum then using
-- it in the same statement batch is the unsafe pattern).
do $$ begin
  create type vehicle_type as enum ('car', 'suv', 'van', 'bike', 'tuktuk');
exception when duplicate_object then null;
end $$;

-- ── vehicles: verticals, rental options, pricing, rules, badges ──
alter table public.vehicles
  add column if not exists vehicle_type      vehicle_type not null default 'car',
  add column if not exists self_drive        boolean not null default true,
  add column if not exists with_driver       boolean not null default false,
  add column if not exists airport_pickup    boolean not null default false,
  add column if not exists daily_rate_usd    integer
                             check (daily_rate_usd is null or daily_rate_usd >= 0),
  add column if not exists mileage_limit      text,
  add column if not exists extra_mileage_lkr  integer
                             check (extra_mileage_lkr is null or extra_mileage_lkr >= 0),
  add column if not exists rules              text[] not null default '{}',
  add column if not exists badges             text[] not null default '{}';

-- Backfill existing rows so they stay live + self-drive by default.
update public.vehicles
  set self_drive = true
  where self_drive is null;

create index if not exists idx_vehicles_type_city_status
  on public.vehicles (vehicle_type, city, status);
create index if not exists idx_vehicles_self_drive    on public.vehicles (self_drive);
create index if not exists idx_vehicles_with_driver   on public.vehicles (with_driver);
create index if not exists idx_vehicles_airport_pickup on public.vehicles (airport_pickup);

-- ── bookings: pickup / return condition photos (handover proof) ──
alter table public.bookings
  add column if not exists pickup_photo_urls  text[],
  add column if not exists return_photo_urls  text[];
