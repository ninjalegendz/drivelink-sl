-- ============================================================
-- Split USING vs WITH CHECK on the agency booking UPDATE policy
-- ============================================================
-- The old policy used a single predicate for both USING and WITH
-- CHECK. WITH CHECK validates the row's NEW state — and it didn't
-- include 'declined' or 'cancelled' in the allowed status list.
--
-- Manifestation: when an agency confirmed booking A, the
-- auto_decline_overlapping_pending() trigger tried to set OTHER
-- pending bookings on the same vehicle to 'declined'. The trigger
-- runs with the user's privileges, so RLS applied — and the
-- WITH CHECK rejected status='declined', failing the entire
-- transaction with "new row violates row-level security policy".
-- Same root cause for manual Decline from the dashboard.
--
-- Fix: USING gates which rows the agency can pick up for update;
-- WITH CHECK gates the post-update status. Allow declined/cancelled
-- as valid update targets so the trigger and the UI both work.
-- ============================================================

drop policy if exists "Agency can confirm or decline booking" on bookings;

create policy "Agency can transition booking"
  on bookings for update
  using (
    agency_id in (select id from agencies where owner_id = auth.uid())
    and status in (
      'pending_confirmation',
      'payment_pending',
      'confirmed',
      'active'
    )
  )
  with check (
    agency_id in (select id from agencies where owner_id = auth.uid())
    and status in (
      'pending_confirmation',
      'payment_pending',
      'confirmed',
      'active',
      'completed',
      'declined',
      'cancelled'
    )
  );
