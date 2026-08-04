-- 066 — Constrain review subject + block ownership (SEC-014, SEC-012)

-- ── SEC-014: a review may only rate the actual counterparty ──────────────
-- The old policy checked you were A party to a completed booking but not that
-- reviewee_id was the OTHER party — so a renter could review themselves, an
-- admin, or an unrelated user, and the rating trigger would recalc that
-- arbitrary profile's public rating. Bind reviewee to the counterparty:
-- renter → the page owner, page owner → the renter.
drop policy if exists "Can only review completed bookings you were part of" on public.reviews;
create policy "Can only review completed bookings you were part of"
  on public.reviews for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.status = 'completed'
        and (
          -- renter reviews the Rental Page's owner
          (b.renter_id = auth.uid()
             and reviewee_id = (select owner_id from public.agencies where id = b.agency_id))
          or
          -- Rental Page owner reviews the renter
          (b.agency_id in (select id from public.agencies where owner_id = auth.uid())
             and reviewee_id = b.renter_id)
        )
    )
  );

-- ── SEC-012: can't block a vehicle you don't own ─────────────────────────
-- The old policy only checked agency_id was one of the caller's agencies, not
-- that vehicle_id belonged to it — so a competitor could insert a month-long
-- block on someone else's vehicle (their own agency_id + the victim's
-- vehicle_id) and knock it out of search/booking. Gate on VEHICLE ownership.
drop policy if exists "Agency owner manages own blocks" on public.vehicle_blocks;
create policy "Agency owner manages own blocks"
  on public.vehicle_blocks for all
  using (
    exists (
      select 1 from public.vehicles v
      join public.agencies a on a.id = v.agency_id
      where v.id = vehicle_blocks.vehicle_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vehicles v
      join public.agencies a on a.id = v.agency_id
      where v.id = vehicle_blocks.vehicle_id and a.owner_id = auth.uid()
    )
  );
