-- 118 - Keep a Rental Page's public/contact boundary tied to the current
-- owner trust state. Signed-in marketplace users must not gain raw contact
-- access merely because a page is public.

create or replace function public.rental_page_is_public(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.agencies a
    join public.profiles p on p.id = a.owner_id
    where a.id = p_agency_id
      and a.is_verified = true
      and a.is_blocked = false
      and a.deleted_at is null
      and a.deactivated_at is null
      and a.whatsapp_number is not null
      and a.whatsapp_verified_at is not null
      and p.kyc_status = 'verified'::public.kyc_status
      and coalesce(p.is_blacklisted, false) = false
      and p.deleted_at is null
  );
$$;

revoke all on function public.rental_page_is_public(uuid) from public;
grant execute on function public.rental_page_is_public(uuid) to anon, authenticated, service_role;

-- Anonymous visitors receive only the existing public-safe column grants.
-- An authenticated account sees a page row only through an owner, staff or
-- admin policy. This prevents a throwaway login from bulk-selecting every
-- active page's WhatsApp number, email, registration data and internal flags.
drop policy if exists "Public can read agencies" on public.agencies;
drop policy if exists "Public can read eligible Rental Pages" on public.agencies;
create policy "Public can read eligible Rental Pages"
  on public.agencies for select
  using (
    (select auth.role()) = 'anon'
    and public.rental_page_is_public(id)
  );

-- These identifiers are not needed by the signed-out storefront. Owners,
-- staff and admins retain their authenticated grants and relationship rules.
revoke select (owner_id, address, is_blocked) on public.agencies from anon;

-- Review insertion needs to confirm that the named review recipient owns the
-- page from the completed booking. Do that as one narrow boolean decision;
-- never reopen the whole page row to the renter's database role.
create or replace function public.renter_can_review_booking(
  p_booking_id uuid,
  p_reviewer_id uuid,
  p_reviewee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings b
    join public.agencies a on a.id = b.agency_id
    where b.id = p_booking_id
      and b.status = 'completed'::public.booking_status
      and b.renter_id = p_reviewer_id
      and a.owner_id = p_reviewee_id
  );
$$;

revoke all on function public.renter_can_review_booking(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.renter_can_review_booking(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "Can only review completed bookings you were part of" on public.reviews;
create policy "Can only review completed bookings you were part of"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and public.renter_can_review_booking(booking_id, reviewer_id, reviewee_id)
  );

drop policy if exists "Public can read available vehicles" on public.vehicles;
create policy "Public can read available vehicles"
  on public.vehicles for select
  using (
    status = 'available'
    and public.rental_page_is_public(agency_id)
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
set search_path = pg_catalog, public, pg_temp
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

create or replace function public.pause_pages_for_ineligible_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.kyc_status <> 'verified'::public.kyc_status
     or coalesce(new.is_blacklisted, false)
     or new.deleted_at is not null then
    update public.agencies
    set deactivated_at = coalesce(deactivated_at, now())
    where owner_id = new.id and deleted_at is null;

    update public.vehicles v
    set status = 'unlisted', paused_at = coalesce(v.paused_at, now())
    where v.status = 'available'
      and exists (
        select 1 from public.agencies a
        where a.id = v.agency_id and a.owner_id = new.id and a.deleted_at is null
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pause_pages_for_ineligible_owner on public.profiles;
create trigger trg_pause_pages_for_ineligible_owner
after update of kyc_status, is_blacklisted, deleted_at on public.profiles
for each row execute function public.pause_pages_for_ineligible_owner();

revoke all on function public.pause_pages_for_ineligible_owner() from public, anon, authenticated;

create or replace function public.guard_booking_confirmation_page_eligibility()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.status::text = 'pending_confirmation'
     and new.status::text = 'confirmed'
     and not public.rental_page_is_public(new.agency_id) then
    raise exception using errcode = 'P0001', message = 'This Rental Page is not eligible to confirm new bookings.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_booking_confirmation_page_eligibility on public.bookings;
create trigger trg_guard_booking_confirmation_page_eligibility
before update of status on public.bookings
for each row execute function public.guard_booking_confirmation_page_eligibility();

revoke all on function public.guard_booking_confirmation_page_eligibility() from public, anon, authenticated;

create or replace function public.set_rental_page_active(
  p_agency_id uuid,
  p_owner_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_row public.agencies%rowtype;
  owner_eligible boolean := false;
begin
  select * into page_row from public.agencies where id = p_agency_id for update;
  if not found or page_row.owner_id <> p_owner_id then
    raise exception using errcode = '42501', message = 'Only the Rental Page owner can change its status.';
  end if;

  if p_active then
    select exists (
      select 1 from public.profiles p
      where p.id = p_owner_id
        and p.kyc_status = 'verified'::public.kyc_status
        and coalesce(p.is_blacklisted, false) = false
        and p.deleted_at is null
    ) into owner_eligible;

    if not owner_eligible then raise exception using errcode = 'P0001', message = 'The page owner must complete identity verification and be eligible before this page can resume.'; end if;
    if page_row.deleted_at is not null then raise exception using errcode = 'P0001', message = 'A deleted Rental Page cannot be resumed.'; end if;
    if page_row.is_blocked then raise exception using errcode = 'P0001', message = 'This Rental Page is suspended.'; end if;
    if not page_row.is_verified then raise exception using errcode = 'P0001', message = 'This Rental Page must be verified before it can resume.'; end if;
    if page_row.whatsapp_number is null or page_row.whatsapp_verified_at is null then
      raise exception using errcode = 'P0001', message = 'Verify the Rental Page phone number before resuming.';
    end if;
    if page_row.name like '(Restored page%' then
      raise exception using errcode = 'P0001', message = 'Update the restored Rental Page details before resuming.';
    end if;

    update public.agencies set deactivated_at = null where id = p_agency_id;
    update public.vehicles
    set status = 'available', paused_at = null
    where agency_id = p_agency_id and paused_at is not null;
  else
    update public.agencies set deactivated_at = now() where id = p_agency_id;
    update public.vehicles
    set status = 'unlisted', paused_at = coalesce(paused_at, now())
    where agency_id = p_agency_id and status = 'available';
  end if;

  return true;
end;
$$;

revoke all on function public.set_rental_page_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_rental_page_active(uuid, uuid, boolean) to service_role;

-- Business verification depends on a registration document that deletion
-- deliberately removes. A restored business must therefore be reviewed again.
update public.agencies
set is_verified = false
where page_type::text = 'business' and deleted_at is not null and is_verified = true;

create or replace function public.soft_delete_rental_page(
  p_agency_id uuid,
  p_source text default 'admin'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_row public.agencies%rowtype;
  short_id text;
begin
  if p_source not in ('account', 'admin') then
    raise exception using errcode = 'P0001', message = 'Invalid Rental Page deletion source.';
  end if;

  select * into page_row from public.agencies where id = p_agency_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Rental Page not found.'; end if;
  if page_row.deleted_at is not null then return false; end if;

  if exists (
    select 1 from public.bookings
    where agency_id = p_agency_id
      and status::text in ('pending_confirmation', 'confirmed', 'payment_pending', 'active', 'disputed')
  ) then
    raise exception using errcode = 'P0001', message = 'Resolve every in-progress booking before deleting this Rental Page.';
  end if;

  short_id := upper(substr(replace(p_agency_id::text, '-', ''), 1, 8));

  update public.agencies set
    name = 'Former Rental Page #' || short_id,
    description = null,
    address = null,
    whatsapp_number = null,
    email = null,
    business_hours = null,
    business_reg_no = null,
    business_reg_url = null,
    logo_url = null,
    cover_url = null,
    is_verified = case when page_row.page_type::text = 'business' then false else page_row.is_verified end,
    is_blocked = true,
    deactivated_at = now(),
    deleted_at = now(),
    deletion_source = p_source,
    blocked_before_deletion = page_row.is_blocked,
    whatsapp_verified_at = null,
    page_otp_hash = null,
    page_otp_expires_at = null
  where id = p_agency_id;

  update public.vehicles
  set status = 'unlisted'
  where agency_id = p_agency_id and status <> 'unlisted';

  delete from public.agency_members where agency_id = p_agency_id;
  update public.agency_member_invitations
  set status = 'cancelled', responded_at = coalesce(responded_at, now()), updated_at = now()
  where agency_id = p_agency_id and status = 'pending';
  update public.rental_page_transfers
  set status = 'cancelled', updated_at = now()
  where agency_id = p_agency_id and status in ('awaiting_recipient', 'cooling_off');

  return true;
end;
$$;

revoke all on function public.soft_delete_rental_page(uuid, text) from public, anon, authenticated;
grant execute on function public.soft_delete_rental_page(uuid, text) to service_role;
