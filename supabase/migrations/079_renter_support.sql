-- 079 — Renter in-app support (MSG-005)
-- The support system was page↔admin only (support_threads.agency_id NOT NULL).
-- Generalise it so a renter can have their own thread with admin: a thread is
-- EITHER a page thread (agency_id set) OR a renter thread (renter_id set).

alter table public.support_threads alter column agency_id drop not null;
alter table public.support_threads add column if not exists renter_id uuid references public.profiles(id) on delete cascade;
alter table public.support_threads add column if not exists has_unread_renter boolean not null default false;

-- One thread per renter; exactly one party per thread.
create unique index if not exists idx_support_threads_renter on public.support_threads(renter_id) where renter_id is not null;
do $$ begin
  alter table public.support_threads add constraint support_thread_one_party
    check ((agency_id is not null) <> (renter_id is not null));
exception when duplicate_object then null; end $$;

-- sender_role may now be 'renter' too.
alter table public.support_messages drop constraint if exists support_messages_sender_role_check;
alter table public.support_messages add constraint support_messages_sender_role_check
  check (sender_role in ('admin', 'agency_owner', 'renter'));

-- SEC-016 trigger: derive 'renter' for renters (was admin|agency_owner only).
create or replace function public.set_support_sender()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  new.sender_id := auth.uid();
  select role::text into r from public.profiles where id = auth.uid();
  new.sender_role := case when r = 'admin' then 'admin'
                          when r = 'agency_owner' then 'agency_owner'
                          else 'renter' end;
  return new;
end $$;

-- Bump trigger: renter/agency messages flag admin unread; admin messages flag
-- the counterpart unread (only the relevant column applies per thread type).
create or replace function public.bump_support_thread()
returns trigger language plpgsql as $$
begin
  update public.support_threads set
    last_message_at   = new.created_at,
    has_unread_admin  = case when new.sender_role in ('agency_owner','renter') then true else has_unread_admin end,
    has_unread_agency = case when new.sender_role = 'admin' then true else has_unread_agency end,
    has_unread_renter = case when new.sender_role = 'admin' then true else has_unread_renter end
  where id = new.thread_id;
  return new;
end $$;

-- RLS: a renter manages + reads/writes their own thread.
drop policy if exists "Renter manages own thread" on public.support_threads;
create policy "Renter manages own thread" on public.support_threads for all using (renter_id = auth.uid());

drop policy if exists "Read accessible support messages" on public.support_messages;
create policy "Read accessible support messages" on public.support_messages for select using (
  thread_id in (select t.id from public.support_threads t join public.agencies a on a.id = t.agency_id where a.owner_id = auth.uid())
  or thread_id in (select id from public.support_threads where renter_id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Insert into accessible thread" on public.support_messages;
create policy "Insert into accessible thread" on public.support_messages for insert with check (
  sender_id = auth.uid() and (
    thread_id in (select t.id from public.support_threads t join public.agencies a on a.id = t.agency_id where a.owner_id = auth.uid())
    or thread_id in (select id from public.support_threads where renter_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
);
