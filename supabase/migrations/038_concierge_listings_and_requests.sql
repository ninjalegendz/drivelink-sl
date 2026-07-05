-- ============================================================
-- Concierge model — agency directory + booking request queue
-- ============================================================
-- DriveLink is pivoting from a self-serve marketplace (agencies own
-- vehicles and accept bookings in-app) to a concierge model where
-- staff (admin) call the agencies on the renter's behalf. The new
-- public site lists hand-curated agencies; renters submit a request;
-- admin works the request to confirmation by phone.
--
-- These tables are NEW and live alongside the existing agencies/
-- vehicles/bookings model — the old pipeline still runs untouched
-- for agencies who are already on it.
-- ============================================================

-- ============================================================
-- agency_listings — manually curated, no auth user attached
-- ============================================================
create table if not exists public.agency_listings (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  logo_url         text,
  location_city    text not null,
  google_rating    numeric(2,1)
                     check (google_rating is null or (google_rating >= 0 and google_rating <= 5)),
  google_reviews   integer
                     check (google_reviews is null or google_reviews >= 0),
  fb_rating        numeric(2,1)
                     check (fb_rating is null or (fb_rating >= 0 and fb_rating <= 5)),
  fb_reviews       integer
                     check (fb_reviews is null or fb_reviews >= 0),
  phone            text not null,                  -- the number admin calls
  whatsapp_number  text,
  website_url      text,
  fb_url           text,
  google_maps_url  text,
  description      text,
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists agency_listings_active_sort_idx
  on public.agency_listings (is_active, sort_order, name);

drop trigger if exists trg_agency_listings_updated_at on public.agency_listings;
create trigger trg_agency_listings_updated_at
  before update on public.agency_listings
  for each row execute function set_updated_at();

alter table public.agency_listings enable row level security;

drop policy if exists "Public reads active agency listings" on public.agency_listings;
drop policy if exists "Admins manage agency listings"      on public.agency_listings;

-- Public (anon + authenticated) can only see active rows. Admins see all.
create policy "Public reads active agency listings"
  on public.agency_listings for select
  using (
    is_active = true
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins manage agency listings"
  on public.agency_listings for all
  using     (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check(exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select on public.agency_listings to anon, authenticated;
grant insert, update, delete on public.agency_listings to authenticated;

-- ============================================================
-- booking_requests — the concierge queue
-- ============================================================
-- Status flow:
--   new            renter just submitted
--   contacted      admin has phoned the agency
--   quoted         admin has a price + agency confirmed availability
--   awaiting_payment   only used when booking_fee_lkr > 0 (deferred)
--   confirmed      everything locked in
--   declined       agency couldn't do it / renter dropped
--   cancelled      pulled later for any reason
-- ============================================================
create table if not exists public.booking_requests (
  id                   uuid primary key default gen_random_uuid(),
  ref                  text not null unique,                -- e.g. REQ-A4F2
  renter_id            uuid not null references public.profiles(id) on delete cascade,
  agency_listing_id    uuid not null references public.agency_listings(id) on delete restrict,
  pickup_location      text,
  start_date           date not null,
  end_date             date not null,
  vehicle_preference   text,                                -- free text: "SUV, automatic"
  budget_per_day_lkr   integer
                         check (budget_per_day_lkr is null or budget_per_day_lkr >= 0),
  notes                text,
  status               text not null default 'new'
                         check (status in ('new','contacted','quoted','awaiting_payment','confirmed','declined','cancelled')),
  quoted_total_lkr     integer
                         check (quoted_total_lkr is null or quoted_total_lkr >= 0),
  booking_fee_lkr      integer not null default 0           -- snapshot at request time
                         check (booking_fee_lkr >= 0),
  decline_reason       text,
  admin_notes          text,                                -- internal-only
  contacted_at         timestamptz,
  quoted_at            timestamptz,
  confirmed_at         timestamptz,
  declined_at          timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint booking_requests_date_order check (end_date > start_date)
);

create index if not exists booking_requests_renter_idx
  on public.booking_requests (renter_id, created_at desc);

create index if not exists booking_requests_status_idx
  on public.booking_requests (status, created_at desc);

create index if not exists booking_requests_agency_idx
  on public.booking_requests (agency_listing_id, created_at desc);

drop trigger if exists trg_booking_requests_updated_at on public.booking_requests;
create trigger trg_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function set_updated_at();

alter table public.booking_requests enable row level security;

drop policy if exists "Renter reads own requests"   on public.booking_requests;
drop policy if exists "Admins read all requests"    on public.booking_requests;
drop policy if exists "Admins update all requests"  on public.booking_requests;
drop policy if exists "Renter cancels own request"  on public.booking_requests;

create policy "Renter reads own requests"
  on public.booking_requests for select
  using (renter_id = auth.uid());

create policy "Admins read all requests"
  on public.booking_requests for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins update all requests"
  on public.booking_requests for update
  using     (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check(exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Let a renter cancel their own request while it's still 'new'.
create policy "Renter cancels own request"
  on public.booking_requests for update
  using     (renter_id = auth.uid() and status = 'new')
  with check(renter_id = auth.uid() and status in ('new','cancelled'));

-- INSERT is intentionally service-role only — the /api/requests route
-- writes via service client after validating auth + KYC-optional rules.

grant select on public.booking_requests to authenticated;
grant update on public.booking_requests to authenticated;

-- ============================================================
-- Realtime publication for the admin queue notifier
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'booking_requests'
    ) then
      execute 'alter publication supabase_realtime add table booking_requests';
    end if;
  end if;
end $$;
