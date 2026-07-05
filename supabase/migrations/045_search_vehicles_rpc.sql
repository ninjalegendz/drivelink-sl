-- 045_search_vehicles_rpc.sql
--
-- Scalable vehicle search. Two problems fixed:
--
--   1. Date-availability filtering used to fetch EVERY booked vehicle id for the
--      window (a full bookings scan) and splice them into a `id NOT IN (...)`
--      list. Once enough vehicles were booked that list overflowed the request
--      URL and the search broke. We move the filtering INTO the database with a
--      per-vehicle NOT EXISTS, so nothing but the page of results crosses the wire.
--
--   2. make/model search used leading-wildcard ILIKE ('%term%'), which can't use
--      a btree index → full scan as inventory grows. Trigram GIN indexes fix that.
--
-- The function is SECURITY DEFINER so it can read bookings / vehicle_blocks (which
-- anon can't see under RLS) to compute availability — but it only ever RETURNS
-- vehicle rows, and only ones with status='available', so no booking data leaks.

create extension if not exists pg_trgm;

create index if not exists idx_vehicles_make_trgm  on public.vehicles using gin (make  gin_trgm_ops);
create index if not exists idx_vehicles_model_trgm on public.vehicles using gin (model gin_trgm_ops);

-- Serves the per-vehicle availability NOT EXISTS below.
create index if not exists idx_bookings_avail
  on public.bookings (vehicle_id, status, start_date, end_date);

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
          and b.status in ('requested','pending_confirmation','confirmed','payment_pending','active','disputed')
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
