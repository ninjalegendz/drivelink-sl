-- DriveLink launch payment model
--
-- * Listing and operating a Rental Page has no DriveLink fee.
-- * The renter booking-confirmation fee is LKR 0 until a payment gateway is
--   deliberately introduced in a later migration.
-- * Rental charges and deposits remain direct renter-to-provider payments.
--
-- Keep the legacy columns for historical compatibility, but make it impossible
-- for old defaults, triggers, or admin controls to revive the retired manual
-- bank-slip/provider-invoice model.

do $$
begin
  if exists (
    select 1 from public.bookings
    where booking_fee_lkr <> 0 or agency_fee_lkr <> 0
  ) then
    raise exception
      'Cannot finalize launch payment model: non-zero historical booking/provider fees require manual review';
  end if;
end
$$;

-- No live production booking uses this retired state. Restore any stray legacy
-- zero-fee row to the normal reserved state before the old endpoints are closed.
update public.bookings
set status = 'confirmed',
    slip_url = null,
    slip_verified_at = null,
    payment_received_at = null
where status = 'payment_pending'
  and booking_fee_lkr = 0;

drop trigger if exists trg_booking_completed_fee on public.bookings;
drop function if exists public.on_booking_completed_set_fee();

alter table public.bookings
  alter column booking_fee_lkr set default 0,
  alter column agency_fee_lkr set default 0;

update public.platform_settings
set booking_fee_lkr = 0
where id = true;

alter table public.bookings
  drop constraint if exists bookings_launch_booking_fee_zero,
  drop constraint if exists bookings_launch_provider_fee_zero;

alter table public.bookings
  add constraint bookings_launch_booking_fee_zero
    check (booking_fee_lkr = 0),
  add constraint bookings_launch_provider_fee_zero
    check (agency_fee_lkr = 0 and agency_fee_collected_at is null);

alter table public.platform_settings
  drop constraint if exists platform_settings_launch_booking_fee_zero;

alter table public.platform_settings
  add constraint platform_settings_launch_booking_fee_zero
    check (booking_fee_lkr = 0);

comment on column public.bookings.booking_fee_lkr is
  'Launch booking-confirmation fee snapshot. Locked to LKR 0 until a gateway migration replaces this constraint.';
comment on column public.bookings.agency_fee_lkr is
  'Deprecated provider-fee field. Locked to 0; DriveLink does not charge Rental Page commission.';
comment on column public.bookings.agency_fee_collected_at is
  'Deprecated provider-invoice field. Must remain null.';

-- Bank details were previously public for the retired manual-transfer flow.
-- Nothing in the renter experience needs platform_settings now. Only admins
-- may read the operational SMS settings; server-side service clients continue
-- to bypass RLS for notification delivery.
drop policy if exists "Public reads platform settings" on public.platform_settings;
drop policy if exists "Admins read platform settings" on public.platform_settings;
create policy "Admins read platform settings"
  on public.platform_settings for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

revoke all on public.platform_settings from anon;
revoke select, update on public.platform_settings from authenticated;
grant select (
  id,
  sms_signup_renter_enabled,
  sms_signup_agency_enabled,
  sms_login_enabled,
  sms_phone_verify_enabled,
  sms_new_booking_agency_enabled,
  sms_booking_status_renter_enabled,
  sms_admin_booking_status_renter_enabled,
  updated_at
) on public.platform_settings to authenticated;
