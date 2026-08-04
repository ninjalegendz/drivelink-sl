-- 058 — Lock protected vehicle columns (SEC-003)
--
-- "Agency owner can manage their vehicles" (FOR ALL) let a verified owner set
-- verified_vehicle=true, is_featured=true, award badges, or flip status to
-- 'available' on their own listings. Two protections:
--
--  (1) Column-level UPDATE grants: the browser (authenticated) may edit the
--      descriptive/terms/pricing fields but NOT status, is_featured,
--      verified_vehicle, badges, slug, or agency_id. Owner unlist/relist and
--      all admin moderation now run on the service client via server routes.
--
--  (2) A BEFORE INSERT guard: new listings are inserted by owners from the
--      browser (INSERT grant kept), and vehicles.status DEFAULTS TO 'available'
--      — so a bare/crafted insert would publish an unreviewed car. The guard
--      forces every owner-created row to is_featured=false, verified_vehicle=
--      false, badges='{}', and status in (pending_review|unlisted). The service
--      role (admin tools / seed) is exempt.

revoke update on public.vehicles from anon, authenticated;
revoke insert on public.vehicles from anon;   -- owners (authenticated) keep INSERT

grant update (
  make, model, year, color, plate_number, insurance_type, fuel_policy,
  daily_rate_lkr, deposit_lkr, seats, transmission, features, city, photos,
  description, monthly_rate_lkr, vehicle_type, self_drive, with_driver,
  airport_pickup, daily_rate_usd, mileage_limit, extra_mileage_lkr, rules,
  fuel_type, luggage, body_type, variant, doors, engine_cc, vin, engine_number,
  odometer_km, weekly_rate_lkr, included_km_per_day, unlimited_km, refuel_fee_lkr,
  cleaning_fee_lkr, late_fee_per_hour_lkr, delivery_available, delivery_fee_lkr,
  min_rental_days, max_rental_days, smoking_allowed, pets_allowed, ride_hail_allowed,
  second_driver_allowed, min_renter_age, min_license_years, restricted_use,
  has_gps_tracker, has_etc_tag, per_km_rate_lkr, tolls_included, driver_bata_lkr,
  revenue_license_expiry, insurance_expiry, emission_expiry
) on public.vehicles to authenticated;

create or replace function public.vehicle_insert_guard()
returns trigger
language plpgsql
as $$
begin
  -- Owners may never create a pre-approved / verified / featured / badged
  -- listing. Service role (admin tooling, seed scripts) is exempt.
  if current_user is distinct from 'service_role' then
    new.is_featured      := false;
    new.verified_vehicle := false;
    new.badges           := '{}';
    if new.status is null or new.status not in ('pending_review', 'unlisted') then
      new.status := 'pending_review';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vehicle_insert_guard on public.vehicles;
create trigger vehicle_insert_guard
  before insert on public.vehicles
  for each row execute function public.vehicle_insert_guard();
