-- ============================================================
-- Pending signups + email tracking
-- ============================================================
-- Holds the not-yet-confirmed signup state (name, phone, optional
-- email, hashed phone OTP) until the renter verifies the OTP. Once
-- verified, we promote to an auth.users + profiles row and delete
-- the pending row.
--
-- Also adds two columns to profiles:
--   - email                — stored separately from auth.users so
--     queries don't need a join. NULL for users who signed up phone-
--     only (those get a placeholder address in auth.users that we
--     never expose).
--   - email_verified_at    — set when the renter clicks the magic
--     link we email them. Drives the public "verified" badge,
--     independent of auth.users.email_confirmed_at (which we always
--     auto-set so passwordless login works without an email).
-- ============================================================

create table if not exists pending_signups (
  phone           text primary key,
  full_name       text not null,
  email           text,
  otp_hash        text not null,
  otp_expires_at  timestamptz not null,
  otp_attempts    integer not null default 0,
  otp_send_count  integer not null default 1,
  otp_last_sent   timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_pending_signups_email on pending_signups(email);

-- Service-only — anon and authenticated never touch this directly.
alter table pending_signups enable row level security;
revoke all on pending_signups from anon, authenticated;

-- Profiles additions
alter table profiles add column if not exists email             text;
alter table profiles add column if not exists email_verified_at timestamptz;

create index if not exists idx_profiles_email on profiles(email);
