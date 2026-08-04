-- 056 — Lock protected profile columns (SEC-001, SEC-002)
--
-- The "Users can update their own profile" RLS policy is row-scoped only
-- (auth.uid() = id) with NO column restriction, and the authenticated role
-- held UPDATE on all 31 profile columns. So any signed-in user could PATCH
-- their own row to:
--   • role = 'admin'                 (self-promote to administrator)
--   • kyc_status = 'verified'        (self-verify identity)
--   • is_blacklisted = false         (clear a blacklist)
--   • booking_frozen = false         (unfreeze an overdue account)
--   • reliability_pct / rating_avg   (inflate their own trust score)
--   • phone_otp_* / nic_number / …   (tamper with auth + identity state)
--
-- Postgres column-level UPDATE grants close this without restructuring the
-- table or the RLS policy: the browser (authenticated role) may now write
-- ONLY genuinely user-owned columns; every protected column is service-role
-- only. The matching release moved KYC submit, admin KYC/blacklist actions,
-- the page-creation role flip, and the email-verify stamp to server routes
-- that use the service client, so no legitimate flow relies on the broad
-- grant any more.
--
-- service_role keeps full access (it is never named in the revoke), so all
-- server routes continue to work.

revoke update on public.profiles from anon, authenticated;

grant update (
  full_name,
  phone,
  avatar_url,
  address,
  license_front_url,
  license_back_url
) on public.profiles to authenticated;
