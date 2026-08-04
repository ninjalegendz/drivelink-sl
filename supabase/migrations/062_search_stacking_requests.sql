-- 062 — Requests stack; only committed bookings hide a vehicle (decision 2)
--
-- Previously search_vehicles treated 'requested' and 'pending_confirmation' as
-- slot-blocking, so a single unanswered request hid a popular car from every
-- other renter for up to 48h — the owner never saw competing requests to
-- choose from (audit BOOK-006). Decision 2: requests STACK. A vehicle is only
-- hidden for a date window once a booking is actually committed
-- (confirmed / payment_pending / active) or under dispute. The
-- auto_decline_overlapping_pending trigger (migration 004) still declines the
-- losing pending requests the moment the owner confirms one.
create or replace function public.search_vehicles(
  p_q         text    default null,
  p_city      text    default null,
  p_type      text    default null,
  p_option    text    default null,
  p_max_price integer default null,
  p_from      date    default null,
  p_to        date    default null,
  p_limit     integer default 48,
  p_offset    integer default 0
)
returns setof public.vehicles
language sql
stable
security definer
set search_path = public
as $$
  select v.*
  from public.vehicles v
  where v.status = 'available'
    and (p_q is null or v.make ilike '%' || p_q || '%' or v.model ilike '%' || p_q || '%')
    and (p_city is null or v.city ilike p_city)
    and (p_type is null or v.vehicle_type::text = p_type)
    and (
      p_option is null
      or (p_option = 'self-drive'     and v.self_drive)
      or (p_option = 'with-driver'    and v.with_driver)
      or (p_option = 'airport-pickup' and v.airport_pickup)
    )
    and (p_max_price is null or v.daily_rate_lkr <= p_max_price)
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.bookings b
        where b.vehicle_id = v.id
          and b.status in ('confirmed','payment_pending','active','disputed')
          and b.start_date <= p_to
          and b.end_date   >= p_from
      )
    )
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.vehicle_blocks vb
        where vb.vehicle_id = v.id
          and vb.start_date <= p_to
          and vb.end_date   >= p_from
      )
    )
  order by v.is_featured desc, v.created_at desc
  limit  greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_vehicles(text, text, text, text, integer, date, date, integer, integer)
  to anon, authenticated;