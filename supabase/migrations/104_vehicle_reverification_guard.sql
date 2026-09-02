-- 104 - Keep live-listing trust statements tied to reviewed information.
--
-- A Rental Page may correct ordinary copy at any time, but changes to a
-- vehicle's identity, price, rental terms, availability mode, photos, or
-- compliance record must return to review before the public listing relies on
-- them. A Verified Vehicle is only awarded after an admin has checked the
-- registration, hire-insurance, and revenue-licence documents.

alter table public.vehicle_documents
  add column if not exists revenue_license_url text;

-- Fleet staff can maintain vehicle evidence for the page they are allowed to
-- manage. This does not grant access to renter identity documents.
drop policy if exists "Owner manages own vehicle documents" on public.vehicle_documents;
drop policy if exists "Fleet staff manage page vehicle documents" on public.vehicle_documents;

create policy "Fleet staff manage page vehicle documents"
  on public.vehicle_documents for all
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_documents.vehicle_id
        and public.has_page_capability(v.agency_id, 'manage_fleet')
    )
  )
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_documents.vehicle_id
        and public.has_page_capability(v.agency_id, 'manage_fleet')
    )
  );

create or replace function public.requeue_vehicle_after_trust_change()
returns trigger
language plpgsql
as $$
begin
  -- Admin routes use the service role and retain their explicit moderation
  -- controls. Browser-side edits are the path that needs this backstop.
  if current_user = 'service_role' then
    return new;
  end if;

  if new.make is distinct from old.make
    or new.model is distinct from old.model
    or new.year is distinct from old.year
    or new.color is distinct from old.color
    or new.plate_number is distinct from old.plate_number
    or new.insurance_type is distinct from old.insurance_type
    or new.fuel_policy is distinct from old.fuel_policy
    or new.daily_rate_lkr is distinct from old.daily_rate_lkr
    or new.daily_rate_usd is distinct from old.daily_rate_usd
    or new.weekly_rate_lkr is distinct from old.weekly_rate_lkr
    or new.monthly_rate_lkr is distinct from old.monthly_rate_lkr
    or new.deposit_lkr is distinct from old.deposit_lkr
    or new.seats is distinct from old.seats
    or new.transmission is distinct from old.transmission
    or new.city is distinct from old.city
    or new.photos is distinct from old.photos
    or new.vehicle_type is distinct from old.vehicle_type
    or new.fuel_type is distinct from old.fuel_type
    or new.luggage is distinct from old.luggage
    or new.body_type is distinct from old.body_type
    or new.variant is distinct from old.variant
    or new.doors is distinct from old.doors
    or new.engine_cc is distinct from old.engine_cc
    or new.odometer_km is distinct from old.odometer_km
    or new.self_drive is distinct from old.self_drive
    or new.with_driver is distinct from old.with_driver
    or new.airport_pickup is distinct from old.airport_pickup
    or new.mileage_limit is distinct from old.mileage_limit
    or new.included_km_per_day is distinct from old.included_km_per_day
    or new.unlimited_km is distinct from old.unlimited_km
    or new.extra_mileage_lkr is distinct from old.extra_mileage_lkr
    or new.delivery_available is distinct from old.delivery_available
    or new.delivery_fee_lkr is distinct from old.delivery_fee_lkr
    or new.min_rental_days is distinct from old.min_rental_days
    or new.max_rental_days is distinct from old.max_rental_days
    or new.refuel_fee_lkr is distinct from old.refuel_fee_lkr
    or new.cleaning_fee_lkr is distinct from old.cleaning_fee_lkr
    or new.late_fee_per_hour_lkr is distinct from old.late_fee_per_hour_lkr
    or new.smoking_allowed is distinct from old.smoking_allowed
    or new.pets_allowed is distinct from old.pets_allowed
    or new.ride_hail_allowed is distinct from old.ride_hail_allowed
    or new.second_driver_allowed is distinct from old.second_driver_allowed
    or new.restricted_use is distinct from old.restricted_use
    or new.min_renter_age is distinct from old.min_renter_age
    or new.min_license_years is distinct from old.min_license_years
    or new.has_gps_tracker is distinct from old.has_gps_tracker
    or new.has_etc_tag is distinct from old.has_etc_tag
    or new.per_km_rate_lkr is distinct from old.per_km_rate_lkr
    or new.tolls_included is distinct from old.tolls_included
    or new.driver_bata_lkr is distinct from old.driver_bata_lkr
    or new.revenue_license_expiry is distinct from old.revenue_license_expiry
    or new.insurance_expiry is distinct from old.insurance_expiry
    or new.emission_expiry is distinct from old.emission_expiry then
    if old.status not in ('pending_review', 'available', 'unlisted') then
      raise exception 'Vehicle details cannot change while the vehicle is rented or in maintenance. Finish that state first.'
        using errcode = 'check_violation';
    end if;

    new.status := 'pending_review';
    new.verified_vehicle := false;
    new.is_featured := false;
    new.badges := '{}';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_vehicle_requeue_after_trust_change on public.vehicles;
create trigger trg_vehicle_requeue_after_trust_change
  before update on public.vehicles
  for each row execute function public.requeue_vehicle_after_trust_change();

create or replace function public.require_verified_vehicle_documents()
returns trigger
language plpgsql
as $$
begin
  if new.verified_vehicle
    and (tg_op = 'INSERT' or new.verified_vehicle is distinct from old.verified_vehicle) then
    if new.insurance_type <> 'hire'
      or not exists (
        select 1
        from public.vehicle_documents d
        where d.vehicle_id = new.id
          and d.cr_url is not null
          and d.insurance_url is not null
          and d.revenue_license_url is not null
      ) then
      raise exception 'Verified Vehicle requires reviewed registration, hire-insurance, and revenue-licence documents.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vehicle_verified_document_guard on public.vehicles;
create trigger trg_vehicle_verified_document_guard
  before insert or update on public.vehicles
  for each row execute function public.require_verified_vehicle_documents();

create or replace function public.requeue_vehicle_after_document_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  affected_vehicle_id uuid := coalesce(new.vehicle_id, old.vehicle_id);
begin
  -- The document row's RLS policy has already proved the caller can manage
  -- this page's fleet. The definer function only performs the protected
  -- moderation-column reset that browser clients cannot write directly.
  if coalesce(auth.role(), '') <> 'service_role' then
    update public.vehicles
      set status = 'pending_review',
          verified_vehicle = false,
          is_featured = false,
          badges = '{}'
      where id = affected_vehicle_id
        and status in ('pending_review', 'available', 'unlisted');

    if not found then
      raise exception 'Vehicle documents cannot change while the vehicle is rented or in maintenance.'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vehicle_documents_requeue_review on public.vehicle_documents;
create trigger trg_vehicle_documents_requeue_review
  after insert or update or delete on public.vehicle_documents
  for each row execute function public.requeue_vehicle_after_document_change();
