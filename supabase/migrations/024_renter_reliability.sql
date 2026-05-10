-- ============================================================
-- Renter reliability score on cancellation
-- ============================================================
-- Mirrors agencies.reliability_pct. Starts NULL (N/A) and ticks down
-- whenever the renter cancels. Penalty scales by:
--   - Stage at cancellation: pre-confirmation = tiny, post-confirmation
--     = big
--   - Time remaining until pickup at the moment of cancel: <24h adds
--     more, <6h adds more again
--   - How long the renter sat on the booking before cancelling
--     (>48h elapsed = +small penalty for stringing the agency along)
--
-- Agency 'decline' and the auto-decline trigger both set status to
-- 'declined' (not 'cancelled'), so they don't trigger this path.
-- ============================================================

create or replace function on_renter_cancel_reliability()
returns trigger language plpgsql as $$
declare
  hours_since_create  numeric;
  hours_until_pickup  numeric;
  penalty             integer;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    hours_since_create := extract(epoch from (now() - new.created_at))                / 3600;
    hours_until_pickup := extract(epoch from (new.start_date::timestamp - now()))     / 3600;

    if old.status in ('requested', 'pending_confirmation') then
      penalty := 2;
    else
      -- Was confirmed (or further along): bigger base hit
      penalty := 10;
      if hours_until_pickup < 24 then penalty := penalty + 10; end if;
      if hours_until_pickup < 6  then penalty := penalty + 10; end if;
      if hours_since_create > 48 then penalty := penalty + 5;  end if;
    end if;

    update profiles
    set reliability_pct = greatest(
      coalesce(reliability_pct, 100) - penalty,
      0
    )
    where id = new.renter_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_renter_cancel_reliability on bookings;
create trigger trg_renter_cancel_reliability
  after update of status on bookings
  for each row
  execute function on_renter_cancel_reliability();

-- Also nudge reliability UP a tiny bit when a booking COMPLETES — gives
-- a recovery path so a single bad cancel isn't a permanent scar.
create or replace function on_booking_completed_reliability()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update profiles
    set reliability_pct = least(
      coalesce(reliability_pct, 100) + 2,
      100
    )
    where id = new.renter_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_renter_complete_reliability on bookings;
create trigger trg_renter_complete_reliability
  after update of status on bookings
  for each row
  execute function on_booking_completed_reliability();
