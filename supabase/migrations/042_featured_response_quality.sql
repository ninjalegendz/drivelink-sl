-- ============================================================
-- Featured listings + response-time tracking + listing quality
-- ============================================================
-- Cost-less trust/growth features from the platform plan:
--  · is_featured  — admin-curated promotion (plan §18 featured listings; no
--    fee during launch, just a ranking boost + badge).
--  · avg_response_minutes — how fast an agency replies to booking requests
--    (plan §16/§18 response-time score). Derived from booking timestamps.
--  · fuel_type / luggage — clean, complete listings (plan §13/§19).
-- ============================================================

-- ── vehicles: featured flag + listing quality fields ──
alter table public.vehicles
  add column if not exists is_featured boolean not null default false,
  add column if not exists fuel_type   text,            -- petrol | diesel | hybrid | electric
  add column if not exists luggage     integer
                             check (luggage is null or luggage >= 0);

create index if not exists idx_vehicles_featured on public.vehicles (is_featured) where is_featured;

-- ── agencies: cached average response time (minutes) ──
alter table public.agencies
  add column if not exists avg_response_minutes integer;

-- Recompute an agency's average first-response time whenever a booking is
-- confirmed or declined. Response = (confirmed_at|declined_at) - created_at.
create or replace function update_agency_response_time()
returns trigger language plpgsql as $$
begin
  update public.agencies
  set avg_response_minutes = (
    select round(avg(extract(epoch from (coalesce(b.confirmed_at, b.declined_at) - b.created_at)) / 60.0))
    from public.bookings b
    where b.agency_id = new.agency_id
      and (b.confirmed_at is not null or b.declined_at is not null)
  )
  where id = new.agency_id;
  return new;
end;
$$;

drop trigger if exists trg_booking_response_time on public.bookings;
create trigger trg_booking_response_time
  after update of status on public.bookings
  for each row
  when (new.status in ('confirmed', 'declined'))
  execute function update_agency_response_time();

-- Backfill existing agencies from any historical confirmed/declined bookings.
update public.agencies a
set avg_response_minutes = sub.avg_min
from (
  select agency_id,
         round(avg(extract(epoch from (coalesce(confirmed_at, declined_at) - created_at)) / 60.0))::int as avg_min
  from public.bookings
  where confirmed_at is not null or declined_at is not null
  group by agency_id
) sub
where a.id = sub.agency_id;
