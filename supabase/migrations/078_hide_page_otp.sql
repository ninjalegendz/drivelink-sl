-- 078 — Hide page OTP secrets from client SELECT (PAGE-012 hardening)
-- page_otp_hash / page_otp_expires_at must be service-role only: an owner who
-- could read the hash could brute-force the 6-digit code offline and "verify" a
-- number they don't control, defeating the OTP. authenticated had a broad
-- agencies SELECT — narrow it to every column EXCEPT the OTP secrets. (anon
-- already uses a column allowlist from 043/055 that never included them.)
revoke select on public.agencies from authenticated;
grant select (
  id, owner_id, name, description, address, city, whatsapp_number, is_verified,
  cancellation_count, confirmed_count, strike_count, reliability_pct, created_at,
  updated_at, is_blocked, deleted_at, sms_notifications_enabled,
  whatsapp_notifications_enabled, avg_response_minutes, provider_type, page_type,
  logo_url, cover_url, email, business_hours, business_reg_no, business_reg_url,
  rating_avg, rating_count, whatsapp_verified_at
) on public.agencies to authenticated;
