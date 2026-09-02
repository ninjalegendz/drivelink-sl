-- 116 - Make Rental Page deletion and pause/resume atomic, and let a deleted
-- page remove its phone number without weakening the live-page phone rule.

alter table public.agencies alter column whatsapp_number drop not null;
alter table public.agencies drop constraint if exists agencies_live_phone_format_check;
alter table public.agencies add constraint agencies_live_phone_format_check
  check (
    whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
    or (whatsapp_number is null and deactivated_at is not null)
  );

create or replace function public.reset_page_phone_verification_on_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.whatsapp_number is distinct from old.whatsapp_number then
    if new.whatsapp_number is null then
      if new.deleted_at is null or new.is_blocked is not true then
        raise exception using errcode = 'P0001', message = 'An active Rental Page must have a phone number.';
      end if;
    elsif new.whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception using errcode = 'P0001', message = 'Rental Page phone numbers must use international format.';
    end if;

    new.whatsapp_verified_at := null;
    new.page_otp_hash := null;
    new.page_otp_expires_at := null;

    -- A changed live number must be verified before the page can resume.
    if new.deleted_at is null then
      new.deactivated_at := coalesce(new.deactivated_at, now());
    end if;

    delete from public.otp_challenges
    where subject_key = 'page:' || old.owner_id::text || ':' || old.id::text
      and purpose = 'phone_verify';
  end if;
  return new;
end;
$$;

create or replace function public.pause_page_vehicles_after_phone_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.deleted_at is null and new.whatsapp_number is distinct from old.whatsapp_number then
    update public.vehicles
    set status = 'unlisted', paused_at = coalesce(paused_at, now())
    where agency_id = new.id and status = 'available';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pause_page_vehicles_after_phone_change on public.agencies;
create trigger trg_pause_page_vehicles_after_phone_change
after update of whatsapp_number on public.agencies
for each row execute function public.pause_page_vehicles_after_phone_change();

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
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental Page not found.';
  end if;
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
declare page_row public.agencies%rowtype;
begin
  select * into page_row from public.agencies where id = p_agency_id for update;
  if not found or page_row.owner_id <> p_owner_id then
    raise exception using errcode = '42501', message = 'Only the Rental Page owner can change its status.';
  end if;

  if p_active then
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

revoke all on function public.reset_page_phone_verification_on_change() from public, anon, authenticated;
revoke all on function public.pause_page_vehicles_after_phone_change() from public, anon, authenticated;
revoke all on function public.soft_delete_rental_page(uuid, text) from public, anon, authenticated;
revoke all on function public.set_rental_page_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.soft_delete_rental_page(uuid, text) to service_role;
grant execute on function public.set_rental_page_active(uuid, uuid, boolean) to service_role;
