-- 105 - A vehicle is public or bookable only while its Rental Page is active.
--
-- Vehicle status is not enough by itself: page pause, block, and deletion are
-- separate safety controls. Enforce that relationship in public table reads,
-- the public search RPC, and the booking route that uses the service role.

drop policy if exists "Public can read available vehicles" on public.vehicles;
create policy "Public can read available vehicles"
  on public.vehicles for select
  using (
    status = 'available'
    and exists (
      select 1
      from public.agencies a
      where a.id = vehicles.agency_id
        and a.is_blocked = false
        and a.deleted_at is null
        and a.deactivated_at is null
    )
  );

create or replace function public.search_vehicles(
  p_q         text    default null,
  p_city      text    default null,
  p_type      text    default null,
  p_option    text    default null,
  p_max_price integer default null,
  p_from      date    default null,
  p_to        date    default null,
  p_limit     integer default 48,
  p_offset    integer default 0,
  p_insurance text    default null
)
returns table (
  id uuid, agency_id uuid, make text, model text, year integer, color text,
  plate_number text, insurance_type public.insurance_type, fuel_policy public.fuel_policy,
  daily_rate_lkr integer, deposit_lkr integer, seats integer, transmission text,
  features text[], status public.vehicle_status, city text, slug text, photos text[],
  created_at timestamptz, updated_at timestamptz, description text, monthly_rate_lkr integer,
  vehicle_type public.vehicle_type, self_drive boolean, with_driver boolean, airport_pickup boolean,
  daily_rate_usd integer, mileage_limit text, extra_mileage_lkr integer, rules text[], badges text[],
  is_featured boolean, fuel_type text, luggage integer, body_type text, variant text, doors integer,
  engine_cc integer, odometer_km integer, weekly_rate_lkr integer, included_km_per_day integer,
  unlimited_km boolean, refuel_fee_lkr integer, cleaning_fee_lkr integer, late_fee_per_hour_lkr integer,
  delivery_available boolean, delivery_fee_lkr integer, min_rental_days integer, max_rental_days integer,
  smoking_allowed boolean, pets_allowed boolean, ride_hail_allowed boolean, second_driver_allowed boolean,
  min_renter_age integer, min_license_years integer, restricted_use text[], has_gps_tracker boolean,
  has_etc_tag boolean, per_km_rate_lkr integer, tolls_included boolean, driver_bata_lkr integer,
  verified_vehicle boolean, revenue_license_expiry date, insurance_expiry date, emission_expiry date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id, v.agency_id, v.make, v.model, v.year, v.color, null::text as plate_number,
    v.insurance_type, v.fuel_policy, v.daily_rate_lkr, v.deposit_lkr, v.seats,
    v.transmission, v.features, v.status, v.city, v.slug, v.photos, v.created_at,
    v.updated_at, v.description, v.monthly_rate_lkr, v.vehicle_type, v.self_drive,
    v.with_driver, v.airport_pickup, v.daily_rate_usd, v.mileage_limit,
    v.extra_mileage_lkr, v.rules, v.badges, v.is_featured, v.fuel_type, v.luggage,
    v.body_type, v.variant, v.doors, v.engine_cc, v.odometer_km, v.weekly_rate_lkr,
    v.included_km_per_day, v.unlimited_km, v.refuel_fee_lkr, v.cleaning_fee_lkr,
    v.late_fee_per_hour_lkr, v.delivery_available, v.delivery_fee_lkr, v.min_rental_days,
    v.max_rental_days, v.smoking_allowed, v.pets_allowed, v.ride_hail_allowed,
    v.second_driver_allowed, v.min_renter_age, v.min_license_years, v.restricted_use,
    v.has_gps_tracker, v.has_etc_tag, v.per_km_rate_lkr, v.tolls_included,
    v.driver_bata_lkr, v.verified_vehicle, v.revenue_license_expiry,
    v.insurance_expiry, v.emission_expiry
  from public.vehicles v
  where v.status = 'available'
    and exists (
      select 1
      from public.agencies a
      where a.id = v.agency_id
        and a.is_blocked = false
        and a.deleted_at is null
        and a.deactivated_at is null
    )
    and (p_q is null or v.make ilike '%' || p_q || '%' or v.model ilike '%' || p_q || '%')
    and (p_city is null or v.city ilike p_city)
    and (p_type is null or v.vehicle_type::text = p_type)
    and (
      p_option is null
      or (p_option = 'self-drive' and v.self_drive)
      or (p_option = 'with-driver' and v.with_driver)
      or (p_option = 'airport-pickup' and v.airport_pickup)
    )
    and (p_max_price is null or v.daily_rate_lkr <= p_max_price)
    and (
      p_insurance is null
      or (p_insurance = 'hire' and v.insurance_type = 'hire'
          and (v.insurance_expiry is null or v.insurance_expiry >= current_date))
    )
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.bookings b
        where b.vehicle_id = v.id
          and b.status in ('confirmed', 'payment_pending', 'active', 'disputed')
          and b.start_date <= p_to
          and b.end_date >= p_from
      )
    )
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.vehicle_blocks vb
        where vb.vehicle_id = v.id
          and vb.start_date <= p_to
          and vb.end_date >= p_from
      )
    )
  order by v.is_featured desc, v.created_at desc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
) from public;
grant execute on function public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
) to anon, authenticated;
