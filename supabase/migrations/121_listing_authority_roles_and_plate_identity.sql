-- 121 - A fleet editor can prepare a vehicle, but only the Rental Page owner
-- or a manager may make the right-to-list declaration. Plate uniqueness uses
-- the physical identifier rather than punctuation chosen during data entry.

drop index if exists public.vehicles_normalized_plate_unique;
create unique index vehicles_normalized_plate_unique
  on public.vehicles ((upper(regexp_replace(btrim(plate_number), '[^[:alnum:]]+', '', 'g'))))
  where plate_number is not null and btrim(plate_number) <> '';

create or replace function public.can_declare_vehicle_authority(
  p_agency_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.agencies a
    where a.id = p_agency_id
      and (
        a.owner_id = p_user_id
        or exists (
          select 1
          from public.agency_members m
          where m.agency_id = a.id
            and m.user_id = p_user_id
            and m.role = 'manager'
        )
      )
  );
$$;

revoke all on function public.can_declare_vehicle_authority(uuid, uuid) from public, anon;
grant execute on function public.can_declare_vehicle_authority(uuid, uuid) to authenticated, service_role;

create or replace function public.stamp_vehicle_listing_authority()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  authority_changed boolean := false;
begin
  if new.plate_number is not null then
    new.plate_number := upper(regexp_replace(btrim(new.plate_number), '[[:space:]]+', ' ', 'g'));
    if new.plate_number = '' then new.plate_number := null; end if;
  end if;

  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.plate_number is null or length(new.plate_number) < 3 then
      raise exception 'Add the vehicle registration plate number before saving.'
        using errcode = 'check_violation';
    end if;

    if tg_op = 'INSERT' then
      authority_changed := coalesce(new.listing_authority_declared, false)
        or new.listing_authority_basis is not null;
    else
      authority_changed := new.listing_authority_declared is distinct from old.listing_authority_declared
        or new.listing_authority_basis is distinct from old.listing_authority_basis;
    end if;

    if authority_changed then
      if not public.can_declare_vehicle_authority(new.agency_id, auth.uid()) then
        raise exception 'Only the Rental Page owner or a manager can confirm the right to list this vehicle.'
          using errcode = 'insufficient_privilege';
      end if;

      if coalesce(new.listing_authority_declared, false)
         and new.listing_authority_basis in ('registered_owner', 'authorized_operator') then
        new.listing_authority_confirmed_at := clock_timestamp();
        new.listing_authority_confirmed_by := auth.uid();
        new.listing_authority_declaration_version := 'vehicle-authority-v1';
      else
        new.listing_authority_declared := false;
        new.listing_authority_basis := null;
        new.listing_authority_confirmed_at := null;
        new.listing_authority_confirmed_by := null;
        new.listing_authority_declaration_version := null;
      end if;
    elsif tg_op = 'INSERT' then
      new.listing_authority_declared := false;
      new.listing_authority_basis := null;
      new.listing_authority_confirmed_at := null;
      new.listing_authority_confirmed_by := null;
      new.listing_authority_declaration_version := null;
    else
      new.listing_authority_confirmed_at := old.listing_authority_confirmed_at;
      new.listing_authority_confirmed_by := old.listing_authority_confirmed_by;
      new.listing_authority_declaration_version := old.listing_authority_declaration_version;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.stamp_vehicle_listing_authority() from public, anon, authenticated;

-- This trigger fires when any publication fact changes, not only when status
-- changes. It therefore blocks a service-side edit that would leave an
-- already-live listing with a missing plate, photo set, declaration or mode.
create or replace function public.require_publishable_available_vehicle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status::text = 'available'
     and not public.vehicle_listing_ready_for_public(new.id) then
    raise exception 'This listing needs a plate, four photos, a current right-to-list declaration, valid rental details, and no unresolved rejection before publication.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.require_publishable_available_vehicle() from public, anon, authenticated;
