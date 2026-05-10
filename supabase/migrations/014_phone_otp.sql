-- ============================================================
-- Phone OTP fields on profiles
-- ============================================================
-- Stores a hashed 6-digit code, expiry, and attempt counter so
-- we can verify the user owns the WhatsApp/SMS number on file.
-- ============================================================

alter table profiles add column if not exists phone_otp_hash       text;
alter table profiles add column if not exists phone_otp_expires_at timestamptz;
alter table profiles add column if not exists phone_otp_attempts   integer not null default 0;
alter table profiles add column if not exists phone_otp_last_sent  timestamptz;
