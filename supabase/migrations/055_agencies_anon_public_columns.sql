-- ============================================================
-- 055 — anon column grants for the public page profile (idempotent)
--
-- 043 switched agencies to COLUMN-LEVEL anon SELECT (so whatsapp_number,
-- email etc. stay unreadable to visitors). Columns added later were never
-- appended to that grant: provider_type (047) and the Rental Pages profile
-- columns (048). Any public query embedding them fails with
-- "permission denied for table agencies" — which 404'd every vehicle
-- detail page for signed-out visitors while working for signed-in ones.
--
-- Grant only the public-safe additions. Deliberately still excluded:
-- whatsapp_number, email, business_reg_no/url, notification toggles,
-- deleted_at.
-- ============================================================

grant select (provider_type, page_type, logo_url, cover_url, business_hours)
  on agencies to anon;
