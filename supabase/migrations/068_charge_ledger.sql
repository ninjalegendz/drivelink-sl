-- 068 — Final charge / settlement ledger (MONEY-005, GAP-006)
--
-- At return there was no single place to record what each side actually owed:
-- extra km, fuel difference, late fee, cleaning, damage, delivery, driver
-- allowance — all discussed in chat, none structured. booking_charges is the
-- itemised ledger of ADDITIONAL charges beyond the rental. Combined with the
-- rental subtotal (already on the booking) and the deposit (deposit_lkr /
-- deposit_return_amount_lkr from the return handshake), it produces one
-- authoritative settlement statement both parties can see and the renter
-- acknowledges. Deposits are represented in the settlement so that, if
-- platform-mediated payment is switched on later, the same structure carries
-- the collect/refund figure without a redesign.
--
-- Writes go through service-role server routes (no client write grant), like
-- bookings; both parties + admin can READ their booking's ledger.

create table if not exists public.booking_charges (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  kind        text not null check (kind in
                ('extra_km','fuel','late','cleaning','damage','delivery','driver','toll','other')),
  label       text,
  amount_lkr  integer not null check (amount_lkr >= 0),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_booking_charges_booking on public.booking_charges(booking_id);

-- The renter's acknowledgement of the final settlement statement.
alter table public.bookings add column if not exists settlement_ack_at timestamptz;

alter table public.booking_charges enable row level security;

drop policy if exists "Booking parties read charges" on public.booking_charges;
create policy "Booking parties read charges"
  on public.booking_charges for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_charges.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from public.agencies where owner_id = auth.uid()))
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Read for the parties; writes are service-role only (server routes).
grant select on public.booking_charges to authenticated;
