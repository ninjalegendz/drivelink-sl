-- 107 - A Verified Vehicle mark requires current compliance dates.
-- This protects service-role and future admin code as well as today's UI.

create or replace function public.enforce_current_vehicle_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verified_vehicle and (
    new.insurance_type <> 'hire'
    or new.insurance_expiry is null
    or new.insurance_expiry < current_date
    or new.revenue_license_expiry is null
    or new.revenue_license_expiry < current_date
  ) then
    raise exception 'Verified Vehicle requires current hire insurance and a current revenue licence';
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_current_verification_guard on public.vehicles;
create trigger vehicles_current_verification_guard
before insert or update on public.vehicles
for each row execute function public.enforce_current_vehicle_verification();

-- Clear stale marks already present at migration time. The daily scheduler
-- repeats this for dates that expire after launch.
update public.vehicles
set verified_vehicle = false
where verified_vehicle = true
  and (
    insurance_type <> 'hire'
    or insurance_expiry is null
    or insurance_expiry < current_date
    or revenue_license_expiry is null
    or revenue_license_expiry < current_date
  );

