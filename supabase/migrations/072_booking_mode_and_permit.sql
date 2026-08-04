-- 072 — Per-booking rental mode + tourist permit + deposit snapshot
--
-- BOOK-011: capture the drive mode the renter actually chose (self-drive vs
-- chauffeured) instead of inferring it from the vehicle, so the licence gate is
-- correct for cars that offer both. TRUST-022: a foreign renter doing self-drive
-- declares they hold/will obtain a valid permit (IDP + local recognition), and
-- the owner is reminded to inspect the original at handover. BOOK-013: the
-- deposit is snapshotted onto the booking at REQUEST time (bookings.deposit_lkr
-- already exists — the API now fills it) so the owner can't raise it before
-- accepting.
alter table public.bookings add column if not exists rental_mode text
  check (rental_mode in ('self_drive', 'with_driver'));
alter table public.bookings add column if not exists is_foreign_renter boolean not null default false;
alter table public.bookings add column if not exists tourist_permit_ack_at timestamptz;
