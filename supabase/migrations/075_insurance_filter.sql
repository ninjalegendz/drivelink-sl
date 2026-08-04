-- 075 — Insurance filter + expiry awareness in search (TRUST-023)
-- Adds p_insurance: when 'hire', return only vehicles that are hire-insured AND
-- whose insurance hasn't lapsed. Dropping the old signature first (adding a
-- param would otherwise create an overload and make the rpc() call ambiguous).
drop function if exists public.search_vehicles(text, text, text, text, integer, date, date, integer, integer);

create or replace function public.search_vehicles(
  p_q         text    default null,
  p_city      text    default null,
  p_type      text    default null,
  p_option    text    default null,
  p_max_price integer default null,
  p_from      date    default null,
  p_to        date    default null,
  p_limit     integer default 48,
  p_offset    integer default 0,
  p_insurance text    default null
)
returns setof public.vehicles
language sql stable security definer set search_path = public
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
      p_insurance is null
      or (p_insurance = 'hire' and v.insurance_type = 'hire'
          and (v.insurance_expiry is null or v.insurance_expiry >= current_date))
    )
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.bookings b
        where b.vehicle_id = v.id
          and b.status in ('confirmed','payment_pending','active','disputed')
          and b.start_date <= p_to and b.end_date >= p_from
      )
    )
    and (
      p_from is null or p_to is null
      or not exists (
        select 1 from public.vehicle_blocks vb
        where vb.vehicle_id = v.id and vb.start_date <= p_to and vb.end_date >= p_from
      )
    )
  order by v.is_featured desc, v.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function public.search_vehicles(text, text, text, text, integer, date, date, integer, integer, text)
  to anon, authenticated;
