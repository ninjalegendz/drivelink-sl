-- 115 - Do not promise an additional-driver workflow that does not exist.
--
-- A safe second driver needs a separate identity, licence review, consent and
-- agreement signature. Until those records exist, a self-drive booking is for
-- the verified account holder only. Signed historic agreement snapshots are
-- left untouched; this changes current listings and future snapshots.

update public.vehicles
set second_driver_allowed = false
where second_driver_allowed = true;

alter table public.vehicles
  alter column second_driver_allowed set default false;

alter table public.vehicles
  drop constraint if exists vehicles_single_verified_renter_driver;
alter table public.vehicles
  add constraint vehicles_single_verified_renter_driver
  check (second_driver_allowed = false) not valid;
alter table public.vehicles
  validate constraint vehicles_single_verified_renter_driver;
