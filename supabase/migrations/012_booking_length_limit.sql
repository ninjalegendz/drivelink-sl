-- ============================================================
-- Allow long-term rentals (up to 1 year)
-- ============================================================
-- Old constraint capped bookings at 30 days. With the monthly-rate
-- pricing path now in place, rentals can legitimately span months.
-- ============================================================

alter table bookings drop constraint if exists max_booking_days;
alter table bookings add  constraint max_booking_days
  check (end_date - start_date <= 365);
