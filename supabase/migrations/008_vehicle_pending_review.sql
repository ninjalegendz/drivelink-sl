-- ============================================================
-- Vehicle review pipeline
-- ============================================================
-- New listings start as 'pending_review'. They are not visible to
-- the public until an admin moves them to 'available'. Admin can
-- also send a listing back by setting it to 'unlisted'.
-- ============================================================

-- Add the new enum value (idempotent)
alter type vehicle_status add value if not exists 'pending_review';

-- Tighten the public read policy: hide pending_review and unlisted
drop policy if exists "Public can read available vehicles" on vehicles;

create policy "Public can read available vehicles"
  on vehicles for select using (status not in ('unlisted', 'pending_review'));
