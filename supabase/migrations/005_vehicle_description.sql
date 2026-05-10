-- ============================================================
-- Add free-form description column to vehicles
-- ============================================================
-- Used for prose-style text on the listing: pickup notes,
-- extras the agency offers (free delivery, child seat on request),
-- anything beyond the structured fields. Subject to admin review.
-- ============================================================

alter table vehicles add column if not exists description text;
