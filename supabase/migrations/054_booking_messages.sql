-- ============================================================
-- 054 — Booking-scoped messaging (idempotent)
--
-- In-app chat between the renter and the Rental Page, scoped to one
-- booking. Opens at request time, lives through the rental, read-only
-- after completion (enforced by the API/UI; RLS grants party access).
-- Replaces "here's my number, call me" as the default channel so the
-- conversation is on the record for dispute resolution.
-- ============================================================

create table if not exists booking_messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id),
  sender_id   uuid not null references profiles(id),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists idx_booking_messages_booking on booking_messages(booking_id, created_at);

-- Per-side read cursors, cheap unread badges without a join table.
alter table bookings
  add column if not exists renter_msgs_read_at timestamptz,
  add column if not exists page_msgs_read_at   timestamptz;

alter table booking_messages enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'booking_messages'
  loop
    execute format('drop policy if exists %I on booking_messages', r.policyname);
  end loop;
end $$;

create policy "Booking parties read messages"
  on booking_messages for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_messages.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

create policy "Booking parties send messages"
  on booking_messages for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = booking_messages.booking_id
        and (b.renter_id = auth.uid()
             or b.agency_id in (select id from agencies where owner_id = auth.uid()))
    )
  );

create policy "Admins read all booking messages"
  on booking_messages for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Realtime, same guarded pattern as 034.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'booking_messages'
    ) then
      execute 'alter publication supabase_realtime add table booking_messages';
    end if;
  end if;
end $$;
