-- ============================================================
-- Track how many OTPs have been sent in the current burst
-- ============================================================
-- Used to escalate the resend cooldown: 60s after the first send,
-- 120s for every subsequent resend within a session. The counter
-- resets to 0 on successful verify or after the user has been idle
-- (no sends) for more than an hour.
-- ============================================================

alter table profiles
  add column if not exists phone_otp_send_count integer not null default 0;
