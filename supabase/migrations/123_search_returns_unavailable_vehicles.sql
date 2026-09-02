-- Date-filtered search used to DROP a vehicle that was already booked or
-- blocked for the requested dates. From a renter's side that is indistinguishable
-- from the vehicle not existing: the fleet appears to shrink for no stated
-- reason, and a vehicle someone saw yesterday is simply gone today.
--
-- Search now returns those vehicles and says why they cannot be booked, so the
-- listing page can show them greyed out with the reason. Two flags rather than
-- one, because the causes are different and only one of them is the provider's
-- doing:
--   booked_in_range   another renter holds those dates
--   blocked_in_range  the provider marked the vehicle unavailable
--
-- No new information is exposed. vehicle_availability() already returns the
-- booked date ranges of any public vehicle to anonymous callers, because the
-- detail page has to grey out taken dates in its picker. These booleans are a
-- strictly coarser view of the same fact, and carry no booking or renter
-- identity.

begin;

-- The return type gains two columns, and Postgres will not replace a function
-- whose OUT columns change, so the old one is dropped by exact signature.
drop function if exists public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
);

create function public.search_vehicles(
  p_q text default null, p_city text default null, p_type text default null,
  p_option text default null, p_max_price integer default null,
  p_from date default null, p_to date default null, p_limit integer default 48,
  p_offset integer default 0, p_insurance text default null
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
  verified_vehicle boolean, revenue_license_expiry date, insurance_expiry date, emission_expiry date,
  booked_in_range boolean, blocked_in_range boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    v.id, v.agency_id, v.make, v.model, v.year, v.color, null::text,
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
    v.insurance_expiry, v.emission_expiry,
    -- Both are false when no date range was given: with no dates to test
    -- against, nothing can be said to clash.
    (
      p_from is not null and p_to is not null
      and exists (
        select 1 from public.bookings b
        where b.vehicle_id = v.id
          and b.status in ('confirmed', 'payment_pending', 'active', 'disputed')
          and b.start_date <= p_to and b.end_date >= p_from
      )
    ) as booked_in_range,
    (
      p_from is not null and p_to is not null
      and exists (
        select 1 from public.vehicle_blocks vb
        where vb.vehicle_id = v.id and vb.start_date <= p_to and vb.end_date >= p_from
      )
    ) as blocked_in_range
  from public.vehicles v
  where v.status = 'available'
    and public.vehicle_listing_ready_for_public(v.id)
    and public.rental_page_is_public(v.agency_id)
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
  -- Bookable ones first. Someone who filtered by dates wants what they can
  -- actually take; the rest stay visible underneath rather than vanishing.
  order by
    (
      (
        p_from is not null and p_to is not null
        and exists (
          select 1 from public.bookings b
          where b.vehicle_id = v.id
            and b.status in ('confirmed', 'payment_pending', 'active', 'disputed')
            and b.start_date <= p_to and b.end_date >= p_from
        )
      )
      or (
        p_from is not null and p_to is not null
        and exists (
          select 1 from public.vehicle_blocks vb
          where vb.vehicle_id = v.id and vb.start_date <= p_to and vb.end_date >= p_from
        )
      )
    ) asc,
    v.is_featured desc,
    v.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

revoke all on function public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
) from public;

grant execute on function public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
) to anon, authenticated;

commit;
