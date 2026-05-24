-- ============================================================
-- Drop email_config table — email creds moved to env vars
-- ============================================================
-- Resend credentials now live in RESEND_API_KEY / RESEND_FROM_EMAIL /
-- RESEND_FROM_NAME env vars on the host (Vercel / Cloudflare Pages),
-- which makes the DB-backed config table redundant. Drop it so we
-- don't carry dead schema (and the email_config_updated_by FK that
-- caused FK-violation friction when deleting admin accounts).
--
-- This drops the table created in 016_email_config.sql and the
-- resend_api_key column added in 030_email_config_resend.sql in one
-- shot.
-- ============================================================

drop table if exists email_config cascade;
