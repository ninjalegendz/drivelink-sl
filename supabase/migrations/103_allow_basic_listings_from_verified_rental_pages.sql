-- 103 - Basic listings are allowed before business verification.
--
-- A Rental Page owner must still be identity-verified and have the Fleet
-- capability. The page's business-verification flag controls its business
-- badge; it must not prevent a basic vehicle listing from reaching admin
-- review. New owner-created listings are still forced to pending_review by
-- vehicle_insert_guard, so this does not publish an unchecked listing.

drop policy if exists "Fleet staff manage page vehicles" on public.vehicles;

create policy "Fleet staff manage page vehicles" on public.vehicles for all
  using (
    agency_id in (
      select a.id
      from public.agencies a
      join public.profiles p on p.id = a.owner_id
      where public.has_page_capability(a.id, 'manage_fleet')
        and a.deleted_at is null
        and p.kyc_status = 'verified'::public.kyc_status
    )
  )
  with check (
    agency_id in (
      select a.id
      from public.agencies a
      join public.profiles p on p.id = a.owner_id
      where public.has_page_capability(a.id, 'manage_fleet')
        and a.deleted_at is null
        and p.kyc_status = 'verified'::public.kyc_status
    )
  );
