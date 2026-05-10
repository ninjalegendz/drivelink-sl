-- ============================================================
-- Split blacklist reasoning into admin-internal + agency-visible
-- ============================================================
-- Existing `blacklist_reason` stays as the admin-only note (private
-- record of what the renter did). New `blacklist_reason_public` is
-- the version that surfaces to agencies on bookings from this renter,
-- so they can decide how to handle the request without admins having
-- to leak sensitive context (e.g. "police report filed").
-- ============================================================

alter table profiles
  add column if not exists blacklist_reason_public text;
