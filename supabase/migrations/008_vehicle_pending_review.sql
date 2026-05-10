-- ============================================================
-- Vehicle review pipeline — Part 1: enum value only
-- ============================================================
-- Adds 'pending_review' to vehicle_status. Postgres won't let
-- you USE a new enum value in the same transaction it was added,
-- so the RLS policy update lives in a separate migration (009).
--
-- Run order: 008 first, then 009.
-- ============================================================

alter type vehicle_status add value if not exists 'pending_review';
