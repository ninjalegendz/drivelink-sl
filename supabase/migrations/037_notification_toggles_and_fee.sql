-- ============================================================
-- SMS notification toggles + booking fee setting
-- ============================================================
-- Adds nine independent on/off switches (one per SMS call site)
-- and a single booking_fee_lkr knob so DriveLink can run the new
-- concierge model free for the first few months. Set the fee to
-- 0 (default) and the payment step is skipped entirely; flip it
-- to any positive number later and the request flow will gate on
-- payment confirmation before final agency booking.
--
-- Defaults are all ON / fee = 0 so existing behaviour is unchanged
-- the moment this migration lands. Toggles are read by the
-- src/lib/sms/gate.ts helper which wraps sendSms().
-- ============================================================

alter table public.platform_settings
  add column if not exists sms_signup_renter_enabled               boolean not null default true,
  add column if not exists sms_signup_agency_enabled               boolean not null default true,
  add column if not exists sms_login_enabled                       boolean not null default true,
  add column if not exists sms_phone_verify_enabled                boolean not null default true,
  add column if not exists sms_new_booking_agency_enabled          boolean not null default true,
  add column if not exists sms_booking_status_renter_enabled       boolean not null default true,
  add column if not exists sms_admin_booking_status_renter_enabled boolean not null default true,
  add column if not exists sms_expiry_renter_enabled               boolean not null default true,
  add column if not exists sms_expiry_agency_enabled               boolean not null default true,
  add column if not exists booking_fee_lkr                         integer not null default 0;

-- booking_fee_lkr must be non-negative; the gate logic treats 0 as "free mode"
alter table public.platform_settings
  drop constraint if exists platform_settings_booking_fee_lkr_nonneg;
alter table public.platform_settings
  add  constraint platform_settings_booking_fee_lkr_nonneg
       check (booking_fee_lkr >= 0);
