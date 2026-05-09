-- ============================================================
-- DriveLink SL — Initial Schema (idempotent, safe to re-run)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS  (DO...EXCEPTION = safe if already exists)
-- ============================================================

do $$ begin
  create type insurance_type as enum ('private', 'hire');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type fuel_policy as enum ('full_to_full', 'same_to_same');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type vehicle_status as enum ('available', 'rented', 'maintenance', 'unlisted');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type booking_status as enum (
    'requested',
    'pending_confirmation',
    'confirmed',
    'payment_pending',
    'active',
    'completed',
    'declined',
    'cancelled',
    'disputed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type kyc_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_role as enum ('renter', 'agency_owner', 'admin');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'renter',
  full_name       text not null,
  phone           text unique not null,
  phone_verified  boolean not null default false,
  kyc_status      kyc_status not null default 'unverified',
  nic_url         text,
  selfie_url      text,
  is_blacklisted  boolean not null default false,
  blacklist_reason text,
  rating_avg      numeric(3,2),
  rating_count    integer not null default 0,
  reliability_pct integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- AGENCIES
-- ============================================================

create table if not exists agencies (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  name            text not null,
  description     text,
  address         text,
  city            text not null,
  whatsapp_number text not null,
  is_verified     boolean not null default false,
  cancellation_count  integer not null default 0,
  confirmed_count     integer not null default 0,
  strike_count        integer not null default 0,
  reliability_pct     integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- VEHICLES
-- ============================================================

create table if not exists vehicles (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  make            text not null,
  model           text not null,
  year            integer not null,
  color           text,
  plate_number    text,
  insurance_type  insurance_type not null,
  fuel_policy     fuel_policy not null default 'full_to_full',
  daily_rate_lkr  integer not null,
  deposit_lkr     integer not null default 0,
  seats           integer not null default 5,
  transmission    text not null default 'automatic',
  features        text[],
  status          vehicle_status not null default 'available',
  city            text not null,
  slug            text unique not null,
  photos          text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_vehicles_slug        on vehicles(slug);
create index if not exists idx_vehicles_city_status on vehicles(city, status);
create index if not exists idx_vehicles_model_city  on vehicles(lower(model), lower(city));

-- ============================================================
-- BOOKINGS
-- ============================================================

create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  vehicle_id          uuid not null references vehicles(id),
  agency_id           uuid not null references agencies(id),
  renter_id           uuid not null references profiles(id),

  status              booking_status not null default 'requested',

  start_date          date not null,
  end_date            date not null,
  total_days          integer generated always as (end_date - start_date) stored,
  daily_rate_lkr      integer not null,
  subtotal_lkr        integer generated always as ((end_date - start_date) * daily_rate_lkr) stored,
  booking_fee_lkr     integer not null default 1000,

  slip_url            text,
  slip_verified_at    timestamptz,
  ocr_amount_lkr      integer,
  ocr_date            date,

  agency_phone        text,

  confirmed_at        timestamptz,
  payment_received_at timestamptz,
  activated_at        timestamptz,
  completed_at        timestamptz,
  declined_at         timestamptz,
  cancelled_at        timestamptz,

  cancellation_reason text,
  dispute_reason      text,

  damage_reported     boolean not null default false,
  damage_notes        text,
  damage_photo_urls   text[],

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint valid_dates check (end_date > start_date),
  constraint max_booking_days check (end_date - start_date <= 30)
);

create index if not exists idx_bookings_renter  on bookings(renter_id, status);
create index if not exists idx_bookings_agency  on bookings(agency_id, status);
create index if not exists idx_bookings_vehicle on bookings(vehicle_id, status);

-- ============================================================
-- REVIEWS
-- ============================================================

create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings(id),
  reviewer_id     uuid not null references profiles(id),
  reviewee_id     uuid not null references profiles(id),
  rating          integer not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now(),

  unique (booking_id, reviewer_id)
);

-- ============================================================
-- BLACKLIST
-- ============================================================

create table if not exists blacklist_reports (
  id              uuid primary key default gen_random_uuid(),
  reported_nic    text not null,
  reported_by     uuid not null references agencies(id),
  booking_id      uuid not null references bookings(id),
  reason          text not null,
  approved        boolean,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- WALLET
-- ============================================================

create table if not exists wallet_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id),
  amount_lkr      integer not null,
  type            text not null,
  booking_id      uuid references bookings(id),
  description     text,
  created_at      timestamptz not null default now()
);

create or replace view wallet_balances as
  select user_id, sum(amount_lkr) as balance_lkr
  from wallet_transactions
  group by user_id;

-- ============================================================
-- AGENCY PENALTIES
-- ============================================================

create table if not exists agency_penalties (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies(id),
  booking_id      uuid not null references bookings(id),
  amount_lkr      integer not null default 2000,
  reason          text not null,
  waived          boolean not null default false,
  waive_proof_url text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at  on profiles;
drop trigger if exists trg_agencies_updated_at  on agencies;
drop trigger if exists trg_vehicles_updated_at  on vehicles;
drop trigger if exists trg_bookings_updated_at  on bookings;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_agencies_updated_at
  before update on agencies
  for each row execute function set_updated_at();

create trigger trg_vehicles_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

create trigger trg_bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- Reliability score

create or replace function update_agency_reliability()
returns trigger language plpgsql as $$
begin
  update agencies
  set
    confirmed_count = (
      select count(*) from bookings
      where agency_id = new.agency_id
        and status in ('active', 'completed', 'cancelled', 'disputed')
    ),
    cancellation_count = (
      select count(*) from bookings
      where agency_id = new.agency_id
        and status = 'declined'
        and confirmed_at is not null
    ),
    reliability_pct = (
      case
        when (
          select count(*) from bookings
          where agency_id = new.agency_id
            and status in ('active', 'completed', 'cancelled', 'disputed')
        ) = 0 then 100
        else (
          select round(
            100.0 * count(*) filter (where status in ('active','completed'))
            / nullif(count(*) filter (where status in ('active','completed','cancelled','disputed')), 0)
          )
          from bookings
          where agency_id = new.agency_id
        )
      end
    )
  where id = new.agency_id;
  return new;
end;
$$;

drop trigger if exists trg_booking_reliability on bookings;
create trigger trg_booking_reliability
  after update of status on bookings
  for each row
  when (new.status in ('active', 'completed', 'declined', 'cancelled'))
  execute function update_agency_reliability();

-- Rating average

create or replace function update_rating_avg()
returns trigger language plpgsql as $$
begin
  update profiles
  set
    rating_avg   = (select avg(rating) from reviews where reviewee_id = new.reviewee_id),
    rating_count = (select count(*) from reviews where reviewee_id = new.reviewee_id)
  where id = new.reviewee_id;
  return new;
end;
$$;

drop trigger if exists trg_review_rating on reviews;
create trigger trg_review_rating
  after insert on reviews
  for each row execute function update_rating_avg();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles             enable row level security;
alter table agencies             enable row level security;
alter table vehicles             enable row level security;
alter table bookings             enable row level security;
alter table reviews              enable row level security;
alter table blacklist_reports    enable row level security;
alter table wallet_transactions  enable row level security;
alter table agency_penalties     enable row level security;

-- Drop policies before recreating (idempotent)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','agencies','vehicles','bookings','reviews','blacklist_reports','wallet_transactions','agency_penalties')
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- PROFILES
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can read their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Public can read basic profile info for reviews"
  on profiles for select using (true);

-- AGENCIES
create policy "Public can read agencies"
  on agencies for select using (true);

create policy "Owner can manage their agency"
  on agencies for all using (auth.uid() = owner_id);

-- VEHICLES
create policy "Public can read available vehicles"
  on vehicles for select using (status != 'unlisted');

create policy "Agency owner can manage their vehicles"
  on vehicles for all using (
    agency_id in (select id from agencies where owner_id = auth.uid())
  );

-- BOOKINGS
create policy "Renter sees own bookings"
  on bookings for select using (auth.uid() = renter_id);

create policy "Agency sees bookings for their vehicles"
  on bookings for select using (
    agency_id in (select id from agencies where owner_id = auth.uid())
  );

create policy "Renter can create a booking"
  on bookings for insert with check (auth.uid() = renter_id);

create policy "Renter can cancel own booking"
  on bookings for update using (
    auth.uid() = renter_id and status in ('requested', 'pending_confirmation', 'confirmed')
  );

create policy "Agency can confirm or decline booking"
  on bookings for update using (
    agency_id in (select id from agencies where owner_id = auth.uid())
    and status in ('pending_confirmation', 'confirmed', 'active', 'completed')
  );

-- REVIEWS
create policy "Reviews are public"
  on reviews for select using (true);

create policy "Can only review completed bookings you were part of"
  on reviews for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from bookings
      where id = booking_id
        and status = 'completed'
        and (renter_id = auth.uid() or agency_id in (
          select id from agencies where owner_id = auth.uid()
        ))
    )
  );

-- WALLET
create policy "Users see own wallet transactions"
  on wallet_transactions for select using (auth.uid() = user_id);

-- PENALTIES
create policy "Agency sees their own penalties"
  on agency_penalties for select using (
    agency_id in (select id from agencies where owner_id = auth.uid())
  );

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Creates the profile row automatically when auth.users is
-- inserted, using metadata passed in signUp({ options: { data } })
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'renter')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- KYC STORAGE BUCKET
-- Public bucket — paths contain UUIDs so not guessable.
-- Only authenticated users can upload to their own folder.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('kyc', 'kyc', true)
on conflict (id) do nothing;

drop policy if exists "Auth users upload KYC"  on storage.objects;
drop policy if exists "Auth users update KYC"  on storage.objects;
drop policy if exists "Auth users delete KYC"  on storage.objects;

create policy "Auth users upload KYC"
  on storage.objects for insert
  with check (
    bucket_id = 'kyc'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Auth users update KYC"
  on storage.objects for update
  using (
    bucket_id = 'kyc'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Auth users delete KYC"
  on storage.objects for delete
  using (
    bucket_id = 'kyc'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
