-- 108 - Guardrails found while tracing complete renter and Rental Page scenarios.
--
-- These checks live in the database because UI controls can be bypassed by a
-- stale tab, an old app build, or a direct API call.

-- Airport handover is a fulfilment option, not a rental mode. Every vehicle
-- must still be self-drive, with-driver, or both.
alter table public.vehicles drop constraint if exists vehicles_rental_mode_required;
alter table public.vehicles add constraint vehicles_rental_mode_required
  check (self_drive = true or with_driver = true) not valid;
alter table public.vehicles validate constraint vehicles_rental_mode_required;

-- A confirmed booking cannot be started after its scheduled rental window has
-- already ended. At that point the page must release it as a no-show instead.
create or replace function public.block_stale_rental_start()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.status::text = 'confirmed'
     and new.status::text = 'active'
     and now() >= old.end_at then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled rental has already ended. Release it as a renter no-show instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_stale_rental_start on public.bookings;
create trigger trg_block_stale_rental_start
  before update of status on public.bookings
  for each row execute function public.block_stale_rental_start();

-- Add late-cancellation strikes atomically in the same transaction as the
-- cancellation. This avoids two simultaneous cancellations overwriting each
-- other's strike count.
create or replace function public.add_page_cancellation_strike()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.status::text in ('confirmed', 'active')
     and new.status::text = 'cancelled'
     and new.cancelled_by = 'page'
     and new.start_at > now()
     and new.start_at <= now() + interval '48 hours' then
    update public.agencies
    set strike_count = strike_count + 1
    where id = new.agency_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_add_page_cancellation_strike on public.bookings;
create trigger trg_add_page_cancellation_strike
  after update of status on public.bookings
  for each row execute function public.add_page_cancellation_strike();

-- Never invent a late fee. The signed listing terms are the only source of an
-- automatic hourly rate; a blank rate produces no automatic charge.
create or replace function public.ensure_late_return_charge(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  terms jsonb;
  scheduled_return timestamptz;
  unit_rate integer;
  late_hours integer;
  amount integer;
  inserted public.booking_charges%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found.'; end if;
  if b.status::text <> 'active' or b.renter_returned_at is null then
    raise exception using errcode = 'P0001', message = 'A late-return item is calculated only after the renter records the return.';
  end if;
  select a.terms into terms from public.booking_agreements a where a.booking_id = b.id;
  if terms is null then raise exception using errcode = 'P0001', message = 'The signed agreement terms are missing.'; end if;
  if exists (select 1 from public.booking_charges c where c.booking_id = b.id and c.kind = 'late' and c.status <> 'waived') then
    select * into inserted from public.booking_charges c where c.booking_id = b.id and c.kind = 'late' and c.status <> 'waived' order by c.created_at limit 1;
    return to_jsonb(inserted);
  end if;

  unit_rate := nullif(terms #>> '{fees,late_fee_per_hour_lkr}', '')::integer;
  if unit_rate is null or unit_rate <= 0 then
    return jsonb_build_object('created', false, 'amount_lkr', 0, 'reason', 'no_listed_late_fee');
  end if;

  scheduled_return := coalesce(b.extended_end_at, b.end_at);
  late_hours := greatest(ceil(extract(epoch from (b.renter_returned_at - (scheduled_return + interval '2 hours'))) / 3600)::integer, 0);
  amount := least(late_hours * unit_rate, b.daily_rate_lkr);
  if amount <= 0 then return jsonb_build_object('created', false, 'amount_lkr', 0, 'reason', 'inside_grace_period'); end if;

  insert into public.booking_charges (
    booking_id, kind, label, amount_lkr, created_by, status, evidence_urls, basis
  ) values (
    b.id, 'late', format('%s chargeable hour%s after the 2-hour grace period', late_hours, case when late_hours = 1 then '' else 's' end),
    amount, null, 'proposed', '{}',
    jsonb_build_object(
      'scheduled_return_at', scheduled_return, 'actual_return_at', b.renter_returned_at,
      'grace_hours', 2, 'chargeable_hours', late_hours,
      'rate_lkr_per_hour', unit_rate, 'daily_rate_cap_lkr', b.daily_rate_lkr,
      'maximum_lkr', amount, 'system_calculated', true
    )
  ) returning * into inserted;
  return to_jsonb(inserted);
end;
$$;

revoke all on function public.ensure_late_return_charge(uuid) from public, anon, authenticated;
grant execute on function public.ensure_late_return_charge(uuid) to service_role;

-- A revoked or still-pending Rental Page cannot stay visible through an old
-- vehicle status. The public search RPC receives the same check in migration
-- 109; this policy protects direct table reads.
drop policy if exists "Public can read available vehicles" on public.vehicles;
create policy "Public can read available vehicles"
  on public.vehicles for select
  using (
    status = 'available'
    and exists (
      select 1
      from public.agencies a
      where a.id = vehicles.agency_id
        and a.is_verified = true
        and a.is_blocked = false
        and a.deleted_at is null
        and a.deactivated_at is null
    )
  );

