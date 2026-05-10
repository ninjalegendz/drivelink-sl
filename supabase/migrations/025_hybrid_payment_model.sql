-- ============================================================
-- Hybrid payment model: smaller renter lock-in + agency completion fee
-- ============================================================
-- Old: renter pays Rs. 1,000 to lock in. Platform takes the lot.
-- New:
--   - Renter pays Rs. 500 to lock in (lower friction; reliability
--     score backstops the lower deposit)
--   - Agency pays Rs. 200 per booking that actually completes
--     (revenue collected only when value is delivered — no defensive
--     declining incentive because agencies aren't billed for leads
--     that ghost or get declined)
-- ============================================================

-- Lower the renter lock-in default. Existing rows keep their value;
-- new INSERTs without an explicit booking_fee_lkr get 500.
alter table bookings
  alter column booking_fee_lkr set default 500;

-- Agency fee — set by trigger on completion. 0 until then.
alter table bookings
  add column if not exists agency_fee_lkr integer not null default 0;

-- Track whether the admin has marked the agency fee as collected
-- (offline bank transfer, etc). Doesn't change billing — just bookkeeping.
alter table bookings
  add column if not exists agency_fee_collected_at timestamptz;

-- Stamp agency_fee_lkr at completion. BEFORE trigger so we mutate NEW
-- and the change is part of the same row write.
create or replace function on_booking_completed_set_fee()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.agency_fee_lkr := 200;
  end if;
  return new;
end $$;

drop trigger if exists trg_booking_completed_fee on bookings;
create trigger trg_booking_completed_fee
  before update of status on bookings
  for each row execute function on_booking_completed_set_fee();
