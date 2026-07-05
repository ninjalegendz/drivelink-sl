-- ============================================================
-- 053 — cancelled_by + agency cancellation_count fix (idempotent)
--
-- Who cancelled matters: page-side cancellations near pickup are the
-- renter-trust killer and feed strikes/ranking; renter and system
-- cancellations shouldn't count against the page. The old
-- update_agency_reliability() formula counted
-- (status='declined' AND confirmed_at IS NOT NULL) — unreachable in
-- the current state machine, so it always recomputed
-- cancellation_count back to 0, stomping any manual increment.
-- ============================================================

alter table bookings
  add column if not exists cancelled_by text check (cancelled_by in ('renter', 'page', 'system'));

-- Backfill from the reason text conventions used so far.
update bookings set cancelled_by = 'page'
  where cancelled_by is null and status = 'cancelled' and cancellation_reason like 'Cancelled by the Rental Page%';
update bookings set cancelled_by = 'renter'
  where cancelled_by is null and status = 'cancelled' and cancellation_reason = 'Cancelled by renter';
update bookings set cancelled_by = 'system'
  where cancelled_by is null and status = 'cancelled';

-- Recreate the reliability function with a correct cancellation_count:
-- page-side cancellations only.
create or replace function update_agency_reliability()
returns trigger language plpgsql as $$
begin
  update agencies
  set
    confirmed_count = (
      select count(*) from bookings
      where agency_id = new.agency_id
        and status in ('active', 'completed', 'cancelled', 'disputed')
    ),
    cancellation_count = (
      select count(*) from bookings
      where agency_id = new.agency_id
        and status = 'cancelled'
        and cancelled_by = 'page'
    ),
    reliability_pct = (
      case
        when (
          select count(*) from bookings
          where agency_id = new.agency_id
            and status in ('active', 'completed', 'cancelled', 'disputed')
        ) = 0 then 100
        else (
          select round(
            100.0 * count(*) filter (where status in ('active','completed'))
            / nullif(count(*) filter (where status in ('active','completed','cancelled','disputed')), 0)
          )
          from bookings
          where agency_id = new.agency_id
        )
      end
    )
  where id = new.agency_id;
  return new;
end;
$$;
