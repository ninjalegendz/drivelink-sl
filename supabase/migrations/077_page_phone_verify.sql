-- 077 — Page WhatsApp/phone OTP verification (PAGE-012)
-- Verify the number that receives booking alerts + is shown to renters, so a
-- mistyped or third-party number can't quietly receive bookings. OTP state +
-- verified stamp are service-role only (not in the authenticated column grant).
alter table public.agencies add column if not exists whatsapp_verified_at timestamptz;
alter table public.agencies add column if not exists page_otp_hash        text;
alter table public.agencies add column if not exists page_otp_expires_at  timestamptz;
