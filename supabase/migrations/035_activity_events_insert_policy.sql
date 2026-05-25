-- ============================================================
-- activity_events: missing INSERT policy
-- ============================================================
-- Migration 029 dropped "Service inserts activity" but never recreated
-- it. With RLS enabled and no INSERT policy, every write into the table
-- is rejected — including the booking-lifecycle trigger and the new
-- /api/admin/bookings/transition route's audit log call.
--
-- Open the insert path. It's an audit log; we don't trust user-supplied
-- rows for anything load-bearing, and only authenticated callers can
-- reach the table at all (anon writes were already revoked above).
-- ============================================================

drop policy if exists "Service inserts activity" on activity_events;
create policy "Service inserts activity"
  on activity_events for insert
  with check (true);

-- ============================================================
-- Bookings: REPLICA IDENTITY FULL so Realtime filters work
-- ============================================================
-- Realtime's postgres_changes filter (e.g. agency_id=eq.<uuid>) only
-- evaluates against columns present in the replication stream. With
-- REPLICA IDENTITY DEFAULT, only the PK is logged — every non-id
-- filter silently matches nothing. Setting FULL logs the whole row
-- so dashboard + admin subscriptions actually receive new bookings.
alter table bookings replica identity full;

