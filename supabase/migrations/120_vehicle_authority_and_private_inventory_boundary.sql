-- 120 - A Basic listing still needs a real vehicle identity and a recorded
-- right-to-list declaration. Public browsing must never expose the provider's
-- private inventory row to an unrelated signed-in database identity.

alter table public.vehicles
  add column if not exists listing_authority_basis text,
  add column if not exists listing_authority_declared boolean not null default false,
  add column if not exists listing_authority_confirmed_at timestamptz,
  add column if not exists listing_authority_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists listing_authority_declaration_version text;

alter table public.vehicles
  drop constraint if exists vehicles_listing_authority_basis_check;
alter table public.vehicles
  add constraint vehicles_listing_authority_basis_check
  check (listing_authority_basis is null or listing_authority_basis in ('registered_owner', 'authorized_operator'));

-- Keep one physical registration plate from being advertised as several
-- vehicles. Null legacy values remain allowed so owners can repair them.
update public.vehicles
set plate_number = upper(regexp_replace(btrim(plate_number), '[[:space:]]+', ' ', 'g'))
where plate_number is not null and btrim(plate_number) <> '';

create unique index if not exists vehicles_normalized_plate_unique
  on public.vehicles ((upper(regexp_replace(btrim(plate_number), '[[:space:]]+', ' ', 'g'))))
  where plate_number is not null and btrim(plate_number) <> '';

grant update (listing_authority_basis, listing_authority_declared)
  on public.vehicles to authenticated;

create or replace function public.stamp_vehicle_listing_authority()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.plate_number is not null then
    new.plate_number := upper(regexp_replace(btrim(new.plate_number), '[[:space:]]+', ' ', 'g'));
    if new.plate_number = '' then new.plate_number := null; end if;
  end if;

  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.plate_number is null or length(new.plate_number) < 3 then
      raise exception 'Add the vehicle registration plate number before submitting.'
        using errcode = 'check_violation';
    end if;
    if not coalesce(new.listing_authority_declared, false)
       or new.listing_authority_basis not in ('registered_owner', 'authorized_operator') then
      raise exception 'Confirm that the Rental Page owns or is authorised to operate this vehicle.'
        using errcode = 'check_violation';
    end if;

    if tg_op = 'INSERT'
       or new.listing_authority_declared is distinct from old.listing_authority_declared
       or new.listing_authority_basis is distinct from old.listing_authority_basis then
      new.listing_authority_confirmed_at := clock_timestamp();
      new.listing_authority_confirmed_by := auth.uid();
      new.listing_authority_declaration_version := 'vehicle-authority-v1';
    else
      new.listing_authority_confirmed_at := old.listing_authority_confirmed_at;
      new.listing_authority_confirmed_by := old.listing_authority_confirmed_by;
      new.listing_authority_declaration_version := old.listing_authority_declaration_version;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists a_stamp_vehicle_listing_authority on public.vehicles;
create trigger a_stamp_vehicle_listing_authority
before insert or update on public.vehicles
for each row execute function public.stamp_vehicle_listing_authority();

revoke all on function public.stamp_vehicle_listing_authority() from public, anon, authenticated;

create or replace function public.vehicle_listing_ready_for_public(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and v.plate_number is not null
      and length(btrim(v.plate_number)) >= 3
      and v.listing_authority_declared = true
      and v.listing_authority_basis in ('registered_owner', 'authorized_operator')
      and v.listing_authority_confirmed_at is not null
      and v.listing_authority_confirmed_by is not null
      and v.listing_authority_declaration_version = 'vehicle-authority-v1'
      and coalesce(array_length(v.photos, 1), 0) >= 4
      and (v.self_drive or v.with_driver)
      and v.daily_rate_lkr >= 500
      and v.rejection_reason is null
  );
$$;

revoke all on function public.vehicle_listing_ready_for_public(uuid) from public;
grant execute on function public.vehicle_listing_ready_for_public(uuid) to anon, authenticated, service_role;

create or replace function public.requeue_vehicle_after_authority_change()
returns trigger
language plpgsql
as $$
begin
  if current_user is distinct from 'service_role'
     and (
       new.listing_authority_basis is distinct from old.listing_authority_basis
       or new.listing_authority_declared is distinct from old.listing_authority_declared
     ) then
    if old.status not in ('pending_review', 'available', 'unlisted') then
      raise exception 'Vehicle authority cannot change while the vehicle is rented or in maintenance.'
        using errcode = 'check_violation';
    end if;
    new.status := 'pending_review';
    new.rejection_reason := null;
    new.verified_vehicle := false;
    new.is_featured := false;
    new.badges := '{}';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vehicle_requeue_after_authority_change on public.vehicles;
create trigger trg_vehicle_requeue_after_authority_change
before update on public.vehicles
for each row execute function public.requeue_vehicle_after_authority_change();

revoke all on function public.requeue_vehicle_after_authority_change() from public, anon, authenticated;

create or replace function public.require_publishable_available_vehicle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status::text = 'available'
     and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and not public.vehicle_listing_ready_for_public(new.id) then
    raise exception 'This listing needs a plate, four photos, a current right-to-list declaration, valid rental details, and no unresolved rejection before publication.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists z_require_publishable_available_vehicle on public.vehicles;
create constraint trigger z_require_publishable_available_vehicle
after insert or update of status, plate_number, photos, listing_authority_basis,
  listing_authority_declared, listing_authority_confirmed_at,
  listing_authority_confirmed_by, listing_authority_declaration_version,
  self_drive, with_driver, daily_rate_lkr, rejection_reason
on public.vehicles
deferrable initially immediate
for each row execute function public.require_publishable_available_vehicle();

revoke all on function public.require_publishable_available_vehicle() from public, anon, authenticated;

-- Legacy rows cannot be silently treated as a legal declaration. Keep them
-- private until an authorised page operator opens the listing, supplies the
-- plate where missing, makes the declaration, and sends it through review.
update public.vehicles
set status = 'unlisted',
    rejection_reason = coalesce(
      rejection_reason,
      'Action needed: add the registration plate, confirm your right to list this vehicle, then resubmit for review.'
    )
where status = 'available'
  and not public.vehicle_listing_ready_for_public(id);

-- Public table reads belong only to the anonymous, safe-column client. An
-- authenticated provider/admin gets rows through the separate relationship
-- policies; an unrelated signed-in user gets no raw inventory rows.
drop policy if exists "Public can read available vehicles" on public.vehicles;
create policy "Public can read available vehicles"
  on public.vehicles for select
  using (
    (select auth.role()) = 'anon'
    and status = 'available'
    and public.vehicle_listing_ready_for_public(id)
    and public.rental_page_is_public(agency_id)
  );

create or replace function public.search_vehicles(
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
  verified_vehicle boolean, revenue_license_expiry date, insurance_expiry date, emission_expiry date
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
    v.insurance_expiry, v.emission_expiry
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
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.bookings b
        where b.vehicle_id = v.id
          and b.status in ('confirmed', 'payment_pending', 'active', 'disputed')
          and b.start_date <= p_to and b.end_date >= p_from
      )
    )
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.vehicle_blocks vb
        where vb.vehicle_id = v.id and vb.start_date <= p_to and vb.end_date >= p_from
      )
    )
  order by v.is_featured desc, v.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

revoke all on function public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
) from public;
grant execute on function public.search_vehicles(
  text, text, text, text, integer, date, date, integer, integer, text
) to anon, authenticated;

create or replace function public.guard_booking_confirmation_page_eligibility()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.status::text = 'pending_confirmation' and new.status::text = 'confirmed' then
    if not public.rental_page_is_public(new.agency_id) then
      raise exception using errcode = 'P0001', message = 'This Rental Page is not eligible to confirm new bookings.';
    end if;
    if not public.vehicle_listing_ready_for_public(new.vehicle_id) then
      raise exception using errcode = 'P0001', message = 'This vehicle must complete listing identity and authority review before the request can be confirmed.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_booking_confirmation_page_eligibility() from public, anon, authenticated;

create or replace function public.set_rental_page_active(
  p_agency_id uuid, p_owner_id uuid, p_active boolean
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
      where p.id = p_owner_id and p.kyc_status = 'verified'::public.kyc_status
        and coalesce(p.is_blacklisted, false) = false and p.deleted_at is null
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
    update public.vehicles v
    set status = 'available', paused_at = null
    where v.agency_id = p_agency_id and v.paused_at is not null
      and public.vehicle_listing_ready_for_public(v.id);
    update public.vehicles
    set paused_at = null
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
