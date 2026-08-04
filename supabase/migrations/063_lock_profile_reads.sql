-- 063 — Lock sensitive profile columns from client SELECT (SEC-006, AUTH-004)
--
-- The "Public can read basic profile info for reviews" policy is USING(true)
-- and anon/authenticated held SELECT on all 31 profile columns, so anyone —
-- including signed-out scrapers — could query phone, email, NIC number,
-- KYC/licence document URLs, OTP hashes, blacklist state, and Didit session
-- ids for every user. Column-level SELECT grants shrink the client-visible
-- surface to the genuinely public trust fields; every sensitive read now goes
-- through service-role server code (account pages, admin dashboards, and the
-- owner bookings list were repointed in the matching release).
--
-- NOTE: column grants can't distinguish "own row", so even a user's own
-- phone/email is no longer readable via a browser session — own-profile
-- screens read via the service client after auth.getUser().

revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  role,
  full_name,
  avatar_url,
  rating_avg,
  rating_count,
  reliability_pct,
  kyc_status,
  phone_verified,
  created_at,
  updated_at
) on public.profiles to anon, authenticated;

-- Vehicles: hide theft-risk identifiers (VIN / engine number) from signed-out
-- traffic. Owners still see them in the edit form (authenticated keeps full
-- SELECT); no public surface renders them.
revoke select on public.vehicles from anon;

grant select (
  id, agency_id, make, model, year, color, plate_number, insurance_type,
  fuel_policy, daily_rate_lkr, deposit_lkr, seats, transmission, features,
  status, city, slug, photos, created_at, updated_at, description,
  monthly_rate_lkr, vehicle_type, self_drive, with_driver, airport_pickup,
  daily_rate_usd, mileage_limit, extra_mileage_lkr, rules, badges, is_featured,
  fuel_type, luggage, body_type, variant, doors, engine_cc, odometer_km,
  weekly_rate_lkr, included_km_per_day, unlimited_km, refuel_fee_lkr,
  cleaning_fee_lkr, late_fee_per_hour_lkr, delivery_available, delivery_fee_lkr,
  min_rental_days, max_rental_days, smoking_allowed, pets_allowed,
  ride_hail_allowed, second_driver_allowed, min_renter_age, min_license_years,
  restricted_use, has_gps_tracker, has_etc_tag, per_km_rate_lkr, tolls_included,
  driver_bata_lkr, verified_vehicle, revenue_license_expiry, insurance_expiry,
  emission_expiry
) on public.vehicles to anon;
