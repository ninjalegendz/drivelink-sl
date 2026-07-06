-- ============================================================
-- 052 — Auto-unfreeze on overdue resolution (idempotent)
--
-- The late-return ladder freezes a renter's account (profiles.
-- booking_frozen) when a booking goes 24h overdue with no return
-- signal. When that booking finally completes (owner confirmed the
-- return, or admin resolved the dispute), lift the freeze — unless
-- the renter has ANOTHER overdue-critical booking still open.
--
-- A trigger (matching this codebase's reliability-trigger pattern)
-- rather than app code, so every completion path (owner transition,
-- admin resolution, future flows) clears it without remembering to.
-- ============================================================

create or replace function clear_booking_freeze()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.overdue_critical_at is not null then
    update profiles
    set booking_frozen = false
    where id = new.renter_id
      and not exists (
        select 1 from bookings
        where renter_id = new.renter_id
          and id <> new.id
          and overdue_critical_at is not null
          and status not in ('completed', 'cancelled', 'declined')
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_booking_freeze on bookings;
create trigger trg_clear_booking_freeze
  after update of status on bookings
  for each row
  when (new.status = 'completed')
  execute function clear_booking_freeze();
