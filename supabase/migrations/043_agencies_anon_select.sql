-- ============================================================
-- Fix: anonymous visitors can't see the marketplace
-- ============================================================
-- Every public vehicle query embeds `agencies(...)` (name, city, rating,
-- reliability, response time). The `anon` role had no SELECT privilege on
-- public.agencies, so those joins failed with "permission denied for table
-- agencies" and logged-out tourists saw an EMPTY marketplace.
--
-- We grant SELECT only on the public-safe columns — crucially NOT
-- `whatsapp_number` — so the provider's contact stays gated (it unlocks for
-- the signed-in renter on their booking page after verification + confirm).
-- RLS ("Public can read agencies") already restricts rows; this adds the
-- table/column privilege PostgREST also requires.
-- ============================================================

grant select (
  id, owner_id, name, city, is_verified,
  reliability_pct, cancellation_count, avg_response_minutes
) on public.agencies to anon;
