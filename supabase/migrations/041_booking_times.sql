-- ============================================================
-- Time-of-day on bookings + concierge requests (strict 24h blocks)
-- ============================================================
-- Renters now pick a pick-up and return TIME, not just a date. Duration
-- (and therefore the fee) is billed in strict 24-hour blocks: any started
-- extra time rounds up to a full day. A 15-minute-late return adds a day.
--   billable_days = greatest(1, ceil(hours / 24))
-- Same-day rentals (e.g. 9am→6pm = 1 day) are allowed.
-- ============================================================

-- ── bookings ────────────────────────────────────────────────
alter table public.bookings
  add column if not exists start_time time not null default '10:00',
  add column if not exists end_time   time not null default '10:00';

-- Combined pick-up / return timestamps — used for conflict checks, ordering
-- and display. (date + time) yields a naive timestamp; both sides are naive
-- so duration math is timezone-independent.
alter table public.bookings
  add column if not exists start_at timestamp generated always as ((start_date + start_time)) stored,
  add column if not exists end_at   timestamp generated always as ((end_date   + end_time))   stored;

-- total_days becomes time-aware: strict 24h blocks, min 1 day. It was a
-- generated column (end_date - start_date); redefine it. Drop + re-add is the
-- only way to change a generated expression. Nothing references it (no views,
-- indexes or policies), so this is safe.
alter table public.bookings drop column if exists total_days;
alter table public.bookings
  add column total_days integer
    generated always as (
      greatest(1, ceil(extract(epoch from ((end_date + end_time) - (start_date + start_time))) / 86400.0)::integer)
    ) stored;

-- Allow same-day rentals (end may share the date) but require the return
-- datetime to be strictly after pick-up.
alter table public.bookings drop constraint if exists valid_dates;
alter table public.bookings drop constraint if exists bookings_valid_datetime;
alter table public.bookings
  add constraint bookings_valid_datetime check ((end_date + end_time) > (start_date + start_time));

-- Conflict checks now compare the combined timestamps.
create index if not exists idx_bookings_vehicle_window
  on public.bookings (vehicle_id, start_at, end_at);

-- ── booking_requests (concierge) ────────────────────────────
alter table public.booking_requests
  add column if not exists start_time time not null default '10:00',
  add column if not exists end_time   time not null default '10:00';

alter table public.booking_requests drop constraint if exists booking_requests_date_order;
alter table public.booking_requests
  add constraint booking_requests_date_order check ((end_date + end_time) > (start_date + start_time));
