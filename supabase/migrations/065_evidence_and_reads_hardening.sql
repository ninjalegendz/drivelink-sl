-- 065 — Evidence-integrity + read-exposure hardening (SEC-015, SEC-017, SEC-013)

-- ── SEC-015: the activity log must not be forgeable ──────────────────────
-- Migration 035 opened INSERT with WITH CHECK(true), so any authenticated
-- user could PostgREST-insert a fabricated event (e.g. actor_role='admin',
-- "dispute resolved"). All real writes go through logEvent() on the service
-- client, so revoke the client INSERT grant entirely — the audit trail is
-- server-generated only. (service_role is never named in the revoke.)
drop policy if exists "Service inserts activity" on public.activity_events;
revoke insert on public.activity_events from anon, authenticated;

-- ── SEC-017: no messaging into a closed booking ──────────────────────────
-- The API blocks it, but a direct PostgREST insert bypassed that (the policy
-- checked party membership only). Add a status guard so a party can't backfill
-- threats/agreements into a completed/declined/cancelled transcript. Active and
-- disputed threads stay open (parties still need to talk during a dispute).
drop policy if exists "Booking parties send messages" on public.booking_messages;
create policy "Booking parties send messages"
  on public.booking_messages for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_messages.booking_id
        and b.status not in ('completed', 'declined', 'cancelled')
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from public.agencies where owner_id = auth.uid()))
    )
  );

-- ── SEC-013: maintenance-block reasons are internal ──────────────────────
-- "Public can read vehicle blocks" USING(true) exposed the free-text `reason`
-- ("owner overseas", "engine failure after crash") to any visitor. Public
-- availability now comes from the date-only vehicle_availability RPC
-- (migration 064), so drop the blanket read policy and revoke anon SELECT.
-- Owners still read/write their OWN blocks (incl. reason) via the existing
-- "Agency owner manages own blocks" FOR ALL policy.
drop policy if exists "Public can read vehicle blocks" on public.vehicle_blocks;
revoke select on public.vehicle_blocks from anon;
