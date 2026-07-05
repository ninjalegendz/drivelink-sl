-- ============================================================
-- 050 — Terms Engine on vehicles (idempotent, additive only)
--
-- Every predictable rental conflict gets a structured, pre-agreed
-- answer captured on the listing, then snapshotted into the
-- per-booking rental agreement (Phase B). Defaults follow current
-- SL market norms so owners recognize them; the platform caps the
-- abuse-prone ones (cleaning fee).
--
-- Also adds the blueprint's extra vehicle-identity fields and the
-- staged-verification flag (Basic listing vs Verified Vehicle).
-- ============================================================

alter table vehicles
  -- Vehicle identity (blueprint's listing form; all optional)
  add column if not exists body_type       text,
  add column if not exists variant         text,
  add column if not exists doors           integer,
  add column if not exists engine_cc       integer,
  add column if not exists vin             text,
  add column if not exists engine_number   text,
  add column if not exists odometer_km     integer,

  -- Pricing additions
  add column if not exists weekly_rate_lkr      integer,
  add column if not exists included_km_per_day  integer,          -- numeric twin of legacy mileage_limit text
  add column if not exists unlimited_km         boolean not null default false,
  add column if not exists refuel_fee_lkr       integer not null default 1000,
  add column if not exists cleaning_fee_lkr     integer not null default 5000,
  add column if not exists late_fee_per_hour_lkr integer,         -- null = daily_rate/8 computed at agreement time
  add column if not exists delivery_available   boolean not null default false,
  add column if not exists delivery_fee_lkr     integer,
  add column if not exists min_rental_days      integer not null default 1,
  add column if not exists max_rental_days      integer,          -- null = platform max (booking constraint)

  -- House rules (structured; replaces free-text-only rules for enforceable terms)
  add column if not exists smoking_allowed       boolean not null default false,
  add column if not exists pets_allowed          boolean not null default false,
  add column if not exists ride_hail_allowed     boolean not null default false,
  add column if not exists second_driver_allowed boolean not null default true,
  add column if not exists min_renter_age        integer not null default 23,
  add column if not exists min_license_years     integer not null default 2,
  -- fixed vocabulary: unpaved_roads | beach_sand | hill_country | flood_water | long_haul_north_east
  add column if not exists restricted_use        text[] not null default '{}',

  -- Disclosures (agreement clauses; PDPA-relevant for the tracker)
  add column if not exists has_gps_tracker boolean not null default false,
  add column if not exists has_etc_tag     boolean not null default false,

  -- With-driver terms (only meaningful when with_driver = true)
  add column if not exists per_km_rate_lkr integer,
  add column if not exists tolls_included  boolean,
  add column if not exists driver_bata_lkr integer,               -- driver overnight allowance, per night

  -- Staged verification + owner-side compliance dates
  add column if not exists verified_vehicle       boolean not null default false,
  add column if not exists revenue_license_expiry date,
  add column if not exists insurance_expiry       date,
  add column if not exists emission_expiry        date;

-- Platform caps on the abuse-prone terms (0 rows today, so safe to add strict).
do $$ begin
  alter table vehicles add constraint vehicles_cleaning_fee_cap  check (cleaning_fee_lkr between 0 and 10000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table vehicles add constraint vehicles_min_age_sane      check (min_renter_age between 18 and 40);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table vehicles add constraint vehicles_min_days_sane     check (min_rental_days >= 1);
exception when duplicate_object then null; end $$;
