-- ============================================================
-- 1. pending_signups gains agency-related columns
-- 2. support_threads + support_messages for the in-app help
--    chat between agencies and admins
-- ============================================================

-- ─── Pending signup payload extension ────────────────────────
alter table pending_signups
  add column if not exists role               text not null default 'renter',
  add column if not exists agency_name        text,
  add column if not exists agency_city        text,
  add column if not exists agency_address     text,
  add column if not exists agency_description text;

alter table pending_signups
  drop constraint if exists pending_signups_role_check;
alter table pending_signups
  add constraint pending_signups_role_check
  check (role in ('renter', 'agency_owner'));

-- ─── Support threads ─────────────────────────────────────────
create table if not exists support_threads (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null unique references agencies(id) on delete cascade,
  last_message_at     timestamptz,
  has_unread_admin    boolean not null default false,
  has_unread_agency   boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_support_threads_last_message on support_threads(last_message_at desc);

-- ─── Support messages ────────────────────────────────────────
create table if not exists support_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references support_threads(id) on delete cascade,
  sender_id     uuid not null references profiles(id),
  sender_role   text not null check (sender_role in ('admin', 'agency_owner')),
  body          text not null check (length(body) > 0 and length(body) <= 4000),
  created_at    timestamptz not null default now()
);

create index if not exists idx_support_messages_thread_created
  on support_messages(thread_id, created_at);

-- ─── RLS ─────────────────────────────────────────────────────
alter table support_threads  enable row level security;
alter table support_messages enable row level security;

drop policy if exists "Agency owner manages own thread"     on support_threads;
drop policy if exists "Admins manage all threads"           on support_threads;
drop policy if exists "Read accessible support messages"    on support_messages;
drop policy if exists "Insert into accessible thread"       on support_messages;

create policy "Agency owner manages own thread"
  on support_threads for all using (
    agency_id in (select id from agencies where owner_id = auth.uid())
  );

create policy "Admins manage all threads"
  on support_threads for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Read accessible support messages"
  on support_messages for select using (
    thread_id in (
      select t.id from support_threads t
      join agencies a on a.id = t.agency_id
      where a.owner_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Insert into accessible thread"
  on support_messages for insert with check (
    sender_id = auth.uid()
    and (
      thread_id in (
        select t.id from support_threads t
        join agencies a on a.id = t.agency_id
        where a.owner_id = auth.uid()
      )
      or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    )
  );

-- ─── Enable Realtime on support tables ───────────────────────
-- Idempotent: drop the table from the publication before re-adding.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table support_threads, support_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
