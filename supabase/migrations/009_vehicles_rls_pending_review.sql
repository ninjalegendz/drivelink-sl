-- ============================================================
-- Vehicle review pipeline — Part 2: tighten public RLS
-- ============================================================
-- Run AFTER 008 (which must be committed first so the new enum
-- value is usable in this policy expression).
--
-- Hides pending_review and unlisted listings from the public.
-- ============================================================

drop policy if exists "Public can read available vehicles" on vehicles;

create policy "Public can read available vehicles"
  on vehicles for select using (status not in ('unlisted', 'pending_review'));
