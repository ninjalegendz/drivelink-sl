-- ============================================================
-- Email transport: SMTP → Resend HTTP API
-- ============================================================
-- nodemailer (raw TCP/SMTP) can't run inside the Cloudflare Workers
-- runtime we're migrating hosting to. Switching to Resend's HTTP API
-- removes that constraint and gets us a per-month free tier that
-- comfortably covers DriveLink's expected volume.
--
-- We keep the existing smtp_* columns around for one release in case
-- we need to revert. A follow-up migration will drop them once Resend
-- is verified in production.
-- ============================================================

alter table email_config
  add column if not exists resend_api_key text;

-- The smtp_username / smtp_password columns are no longer required —
-- relax the NOT NULL guards in case they exist (defensive; they don't
-- have NOT NULL today but a future schema dump might).
-- (No DROP NOT NULL needed: existing schema is already nullable.)

comment on column email_config.resend_api_key is
  'Resend API key (write-only from admin UI). Replaces SMTP creds.';
