-- ============================================================
-- Realtime publication for bookings + vehicles join read
-- ============================================================
-- Lets the agency dashboard + admin pages subscribe to INSERT/UPDATE
-- events on the bookings table via Supabase Realtime. Browser plays
-- a sound + shows a toast/push notification when a new booking lands.
--
-- Filtering happens client-side: the dashboard subscribes with
-- `filter: agency_id=eq.<my-agency-id>`, admin pages subscribe to all.
--
-- Existing RLS still gates SELECTs — Realtime piggybacks on RLS, so
-- agency owners only see their own rows, admins see everything.
-- ============================================================

-- Add the bookings table to the supabase_realtime publication. The
-- publication is created automatically when Realtime is enabled on the
-- project, so this is safe to run idempotently.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- IF NOT EXISTS isn't available for ADD TABLE in older PG; check first.
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'bookings'
    ) then
      execute 'alter publication supabase_realtime add table bookings';
    end if;
  end if;
end $$;
