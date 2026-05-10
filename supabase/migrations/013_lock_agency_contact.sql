-- ============================================================
-- Lock agencies.whatsapp_number from the anon role
-- ============================================================
-- The "Public can read agencies" RLS policy allows everyone to read
-- agencies, which means an attacker with the anon key could hit
-- /rest/v1/agencies?select=whatsapp_number and bulk-scrape every
-- agency's WhatsApp number — bypassing our marketplace fee model.
-- Postgres column-level grants close this without restructuring the
-- table: anon can still SELECT the public columns but the
-- whatsapp_number column is fenced off entirely.
-- Authenticated users still see whatsapp_number — protected because
-- we tie its render-time exposure to having a paid booking via the
-- /bookings/[id] page (only the renter on that booking sees it).
-- ============================================================

revoke all on agencies from anon;

grant select (
  id, owner_id, name, description, address, city,
  is_verified, is_blocked,
  cancellation_count, confirmed_count, strike_count, reliability_pct,
  created_at, updated_at
) on agencies to anon;

-- Authenticated continues to have full access; the RLS policies above
-- already constrain by relationship.
grant select on agencies to authenticated;
grant insert, update, delete on agencies to authenticated;
