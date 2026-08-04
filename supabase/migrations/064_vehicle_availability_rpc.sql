-- 064 — Privacy-safe public availability (BOOK-009)
--
-- The vehicle detail page and the search modal read `bookings` directly to
-- grey out taken dates. Under booking RLS (party-only) a signed-out visitor
-- reads ZERO bookings, so the calendar showed a fully-booked car as wide open
-- — the renter fills the form and only then gets "already booked". This RPC is
-- SECURITY DEFINER so it can see committed bookings + maintenance blocks to
-- compute availability, but it RETURNS ONLY blocked date ranges (no renter,
-- price, status or block-reason data), so nothing sensitive leaks. Committed-
-- only, matching decision 2 (pending requests don't block).
create or replace function public.vehicle_availability(p_vehicle_id uuid)
returns table(start_date date, end_date date)
language sql
stable
security definer
set search_path = public
as $$
  select b.start_date, b.end_date
  from public.bookings b
  where b.vehicle_id = p_vehicle_id
    and b.status in ('confirmed', 'payment_pending', 'active', 'disputed')
    and b.end_date >= current_date
  union all
  select vb.start_date, vb.end_date
  from public.vehicle_blocks vb
  where vb.vehicle_id = p_vehicle_id
    and vb.end_date >= current_date;
$$;

grant execute on function public.vehicle_availability(uuid) to anon, authenticated;
