-- ============================================================
-- Same USING vs WITH CHECK split for the renter cancel policy
-- ============================================================
-- Old "Renter can cancel own booking" policy used a single predicate
-- for both clauses, with status restricted to requested /
-- pending_confirmation / confirmed. That meant the renter could PICK
-- UP rows in those states, but setting status to 'cancelled' failed
-- the implicit WITH CHECK — same root cause as the agency policy fix
-- in migration 021.
-- ============================================================

drop policy if exists "Renter can cancel own booking" on bookings;

create policy "Renter can cancel own booking"
  on bookings for update
  using (
    auth.uid() = renter_id
    and status in ('requested', 'pending_confirmation', 'confirmed', 'payment_pending')
  )
  with check (
    auth.uid() = renter_id
    and status in ('requested', 'pending_confirmation', 'confirmed', 'payment_pending', 'cancelled')
  );

-- Renter slip upload (status → payment_pending) is currently covered by
-- the above too; including 'payment_pending' in both clauses keeps slip
-- uploads + cancellation working through the same policy.
