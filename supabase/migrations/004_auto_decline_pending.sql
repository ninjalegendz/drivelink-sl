-- ============================================================
-- Auto-decline overlapping pending bookings on confirmation
-- ============================================================
-- When an agency confirms a booking, any other PENDING booking on the
-- same vehicle whose dates overlap is automatically declined. The
-- renters of those losing requests are not on the hook for anything,
-- and the agency does not have to manually decline each one.
-- ============================================================

create or replace function auto_decline_overlapping_pending()
returns trigger language plpgsql as $$
begin
  if new.status = 'confirmed' and (old.status is distinct from 'confirmed') then
    update bookings
    set status              = 'declined',
        declined_at         = now(),
        cancellation_reason = coalesce(
          cancellation_reason,
          'Dates booked by another renter'
        )
    where vehicle_id  = new.vehicle_id
      and id         != new.id
      and status      = 'pending_confirmation'
      and start_date  < new.end_date
      and end_date    > new.start_date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_decline_pending on bookings;

create trigger trg_auto_decline_pending
  after update of status on bookings
  for each row
  execute function auto_decline_overlapping_pending();
