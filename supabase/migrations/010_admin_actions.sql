-- ============================================================
-- Admin actions: full RLS for admins + agency block/unblock
-- ============================================================
-- 1. Adds an `is_blocked` column to agencies (separate from
--    `is_verified` so we can distinguish "pending review" from
--    "blocked by admin").
-- 2. Grants admin role full read/write on profiles, agencies,
--    vehicles, bookings — needed so the admin pages and the
--    public vehicle Preview link work for pending listings.
-- ============================================================

alter table agencies add column if not exists is_blocked boolean not null default false;

-- ─── PROFILES ─────────────────────────────────────────────────
drop policy if exists "Admins can update any profile" on profiles;
create policy "Admins can update any profile"
  on profiles for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admins can delete any profile" on profiles;
create policy "Admins can delete any profile"
  on profiles for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ─── AGENCIES ─────────────────────────────────────────────────
drop policy if exists "Admins can manage all agencies" on agencies;
create policy "Admins can manage all agencies"
  on agencies for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ─── VEHICLES ─────────────────────────────────────────────────
-- So admins see pending_review listings AND can preview them on
-- the public detail page (which uses the regular RLS-respecting
-- client).
drop policy if exists "Admins can manage all vehicles" on vehicles;
create policy "Admins can manage all vehicles"
  on vehicles for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ─── BOOKINGS ─────────────────────────────────────────────────
drop policy if exists "Admins can manage all bookings" on bookings;
create policy "Admins can manage all bookings"
  on bookings for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
