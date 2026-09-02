-- 085 - Exact-booking document access, named audit trail, and staff privacy permission.

alter table public.agency_members
  add column if not exists can_view_renter_documents boolean not null default false,
  add column if not exists document_permission_granted_by uuid references public.profiles(id) on delete set null,
  add column if not exists document_permission_granted_at timestamptz;

create table if not exists public.agency_member_permission_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  permission text not null check (permission in ('view_renter_documents')),
  enabled boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_permission_events_agency
  on public.agency_member_permission_events(agency_id, created_at desc);

alter table public.agency_member_permission_events enable row level security;
revoke all on public.agency_member_permission_events from anon, authenticated;
grant select on public.agency_member_permission_events to authenticated;
grant all on public.agency_member_permission_events to service_role;

drop policy if exists "Owners read member permission events" on public.agency_member_permission_events;
create policy "Owners read member permission events"
  on public.agency_member_permission_events for select
  using (exists (
    select 1 from public.agencies a
    where a.id = agency_member_permission_events.agency_id
      and a.owner_id = auth.uid()
  ));

create or replace function public.set_agency_member_document_permission(
  p_agency_id uuid,
  p_member_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.agencies a
    where a.id = p_agency_id and a.owner_id = auth.uid()
  ) then
    raise exception 'Only the page owner can change document permissions';
  end if;

  update public.agency_members
  set can_view_renter_documents = p_enabled,
      document_permission_granted_by = case when p_enabled then auth.uid() else null end,
      document_permission_granted_at = case when p_enabled then now() else null end
  where agency_id = p_agency_id and user_id = p_member_user_id;

  if not found then raise exception 'Team member not found'; end if;

  insert into public.agency_member_permission_events (
    agency_id, member_user_id, changed_by, permission, enabled
  ) values (
    p_agency_id, p_member_user_id, auth.uid(), 'view_renter_documents', p_enabled
  );
end;
$$;

revoke all on function public.set_agency_member_document_permission(uuid, uuid, boolean) from public;
grant execute on function public.set_agency_member_document_permission(uuid, uuid, boolean) to authenticated;

alter table public.document_access_log
  alter column booking_id drop not null,
  add column if not exists renter_id uuid references public.profiles(id) on delete set null,
  add column if not exists agency_id uuid references public.agencies(id) on delete set null,
  add column if not exists viewer_name text,
  add column if not exists viewer_role text,
  add column if not exists purpose text,
  add column if not exists object_key text,
  add column if not exists outcome text not null default 'allowed',
  add column if not exists denial_reason text;

alter table public.document_access_log
  drop constraint if exists document_access_log_outcome_check;
alter table public.document_access_log
  add constraint document_access_log_outcome_check check (outcome in ('allowed', 'denied'));

update public.document_access_log l
set renter_id = b.renter_id,
    agency_id = b.agency_id,
    viewer_name = coalesce(
      (select coalesce(p.full_name, p.email) from public.profiles p where p.id = l.viewer_id),
      left(l.viewer_id::text, 8)
    ),
    viewer_role = coalesce(l.viewer_role, 'page_staff')
from public.bookings b
where b.id = l.booking_id
  and (l.renter_id is null or l.agency_id is null or l.viewer_name is null);

create index if not exists idx_doc_access_renter
  on public.document_access_log(renter_id, created_at desc);
create index if not exists idx_doc_access_agency
  on public.document_access_log(agency_id, created_at desc);

drop policy if exists "Renter reads own document access trail" on public.document_access_log;
create policy "Renter reads own document access trail"
  on public.document_access_log for select
  using (
    renter_id = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.id = document_access_log.booking_id and b.renter_id = auth.uid()
    )
  );

drop policy if exists "Page owners read document access trail" on public.document_access_log;
create policy "Page owners read document access trail"
  on public.document_access_log for select
  using (exists (
    select 1 from public.agencies a
    where a.id = document_access_log.agency_id and a.owner_id = auth.uid()
  ));
