-- Remember which channel delivered the latest signup OTP, so /verify knows
-- whether the PHONE was actually proven (SMS / WhatsApp) or only the email
-- (in which case the account is created with phone_verified = false).
alter table pending_signups add column if not exists otp_channel text;
