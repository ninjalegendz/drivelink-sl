-- ============================================================
-- Verification gates — RLS-enforced
-- ============================================================
-- Two product rules:
--   1. Agencies MUST be verified before listing/managing vehicles:
--      both the owner's KYC and the agency admin-approval must clear.
--   2. Renters MUST have KYC verified before they can create a booking.
--      (They can still browse and view listings — those policies are
--      unchanged.)
--
-- RLS is the source of truth here — application-layer checks in API
-- routes only exist to surface clearer errors. Bypassing the API and
-- going straight to PostgREST will hit these policies and fail.
-- ============================================================

-- ─── Vehicles: agency owner must be verified AND agency admin-approved
drop policy if exists "Agency owner can manage their vehicles" on vehicles;
create policy "Agency owner can manage their vehicles"
  on vehicles for all using (
    agency_id in (
      select a.id
      from agencies a
      join profiles p on p.id = a.owner_id
      where a.owner_id    = auth.uid()
        and a.is_verified = true
        and p.kyc_status  = 'verified'
    )
  );

-- ─── Bookings: renter must have KYC verified
drop policy if exists "Renter can create a booking" on bookings;
create policy "Renter can create a booking"
  on bookings for insert with check (
    auth.uid() = renter_id
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and kyc_status = 'verified'
    )
  );
