-- ============================================================
-- Booking date overlap prevention
-- ============================================================
-- Two bookings on the same vehicle cannot overlap once they reach
-- 'confirmed' (or any status downstream of it). 'pending_confirmation'
-- requests are allowed to stack — the agency picks one and the others
-- can be declined manually. The DB constraint kicks in the moment a
-- second booking tries to be confirmed for overlapping dates.
--
-- daterange( ..., '[)') = half-open interval, so a booking
-- Jan 1 -> Jan 5 occupies Jan 1..4 and a booking Jan 5 -> Jan 10
-- starts cleanly the same day with no overlap (matches our
-- check-out / check-in semantics).
-- ============================================================

create extension if not exists btree_gist;

alter table bookings drop constraint if exists no_overlapping_active_bookings;

alter table bookings add constraint no_overlapping_active_bookings
  exclude using gist (
    vehicle_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
  where (status in ('confirmed', 'payment_pending', 'active'));
