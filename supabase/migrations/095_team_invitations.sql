-- 095 - Two-sided, time-limited Rental Page team invitations.
--
-- agency_members remains the source of active staff access. An invitation is
-- deliberately a separate row, so a mistyped address or inactive account can
-- never become staff merely because the owner pressed Invite.

create table if not exists public.agency_member_invitations (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  invitee_id      uuid not null references public.profiles(id) on delete cascade,
  invited_by      uuid not null references public.profiles(id) on delete restrict,
  invited_email   text not null,
  role            text not null default 'manager' check (role in ('manager')),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_agency_member_invitations_one_pending
  on public.agency_member_invitations (agency_id, invitee_id)
  where status = 'pending';
create index if not exists idx_agency_member_invitations_invitee
  on public.agency_member_invitations (invitee_id, status, expires_at);
create index if not exists idx_agency_member_invitations_agency
  on public.agency_member_invitations (agency_id, status, created_at desc);

drop trigger if exists trg_agency_member_invitations_updated_at on public.agency_member_invitations;
create trigger trg_agency_member_invitations_updated_at
  before update on public.agency_member_invitations
  for each row execute function public.set_updated_at();

create table if not exists public.agency_member_access_events (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  invitation_id   uuid references public.agency_member_invitations(id) on delete set null,
  actor_id        uuid references public.profiles(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  event_type      text not null check (event_type in ('invited', 'accepted', 'declined', 'cancelled', 'expired', 'removed')),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_agency_member_access_events_agency
  on public.agency_member_access_events (agency_id, created_at desc);

alter table public.agency_member_invitations enable row level security;
alter table public.agency_member_access_events enable row level security;
revoke all on public.agency_member_invitations, public.agency_member_access_events from anon, authenticated;
grant all on public.agency_member_invitations, public.agency_member_access_events to service_role;

-- Notification outbox is also used for non-booking account invitations. The
-- same retry/dead-letter rules apply; it simply has no booking_id.
alter table public.notification_outbox drop constraint if exists notification_outbox_recipient_kind_check;
alter table public.notification_outbox add constraint notification_outbox_recipient_kind_check
  check (recipient_kind in ('renter', 'page', 'admin', 'account'));

create or replace function public.create_agency_member_invitation(
  p_agency_id uuid,
  p_owner_id uuid,
  p_invitee_id uuid,
  p_invited_email text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_row public.agencies%rowtype;
  invitee public.profiles%rowtype;
  invitation public.agency_member_invitations%rowtype;
  used_slots integer;
begin
  select * into page_row from public.agencies where id = p_agency_id for update;
  if not found or page_row.owner_id <> p_owner_id then
    raise exception using errcode = '42501', message = 'Only the Rental Page owner can invite staff.';
  end if;
  if page_row.owner_id = p_invitee_id then
    raise exception using errcode = 'P0001', message = 'You already own this Rental Page.';
  end if;
  select * into invitee from public.profiles where id = p_invitee_id;
  if not found or invitee.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'That DriveLink account is not available for a team invitation.';
  end if;
  if invitee.is_blacklisted then
    raise exception using errcode = 'P0001', message = 'That account is not eligible for Rental Page staff access.';
  end if;
  if exists (select 1 from public.agency_members where agency_id = p_agency_id and user_id = p_invitee_id) then
    raise exception using errcode = 'P0001', message = 'That person is already on this Rental Page team.';
  end if;
  if exists (select 1 from public.agency_member_invitations where agency_id = p_agency_id and invitee_id = p_invitee_id and status = 'pending' and expires_at > now()) then
    raise exception using errcode = 'P0001', message = 'That person already has a pending invitation.';
  end if;
  with expired as (
    update public.agency_member_invitations
    set status = 'expired', responded_at = now()
    where agency_id = p_agency_id and invitee_id = p_invitee_id and status = 'pending' and expires_at <= now()
    returning id, agency_id, invitee_id
  )
  insert into public.agency_member_access_events (agency_id, invitation_id, actor_id, subject_user_id, event_type)
  select agency_id, id, p_owner_id, invitee_id, 'expired' from expired;

  select count(*)::integer into used_slots
  from (
    select user_id from public.agency_members where agency_id = p_agency_id
    union all
    select invitee_id from public.agency_member_invitations where agency_id = p_agency_id and status = 'pending' and expires_at > now()
  ) slots;
  if used_slots >= 25 then
    raise exception using errcode = 'P0001', message = 'This Rental Page already has 25 active or pending team places.';
  end if;

  insert into public.agency_member_invitations (agency_id, invitee_id, invited_by, invited_email)
  values (p_agency_id, p_invitee_id, p_owner_id, lower(btrim(p_invited_email)))
  returning * into invitation;
  insert into public.agency_member_access_events (agency_id, invitation_id, actor_id, subject_user_id, event_type, metadata)
  values (p_agency_id, invitation.id, p_owner_id, p_invitee_id, 'invited', jsonb_build_object('expires_at', invitation.expires_at));
  return jsonb_build_object('id', invitation.id, 'expires_at', invitation.expires_at);
end;
$$;

create or replace function public.respond_to_agency_member_invitation(
  p_invitation_id uuid,
  p_actor_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  invitation public.agency_member_invitations%rowtype;
  page_row public.agencies%rowtype;
  used_slots integer;
begin
  select * into invitation from public.agency_member_invitations where id = p_invitation_id for update;
  if not found or invitation.invitee_id <> p_actor_id then
    raise exception using errcode = '42501', message = 'This invitation is not available to this account.';
  end if;
  if invitation.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'This invitation has already been answered.';
  end if;
  if invitation.expires_at <= now() then
    update public.agency_member_invitations set status = 'expired', responded_at = now() where id = invitation.id;
    insert into public.agency_member_access_events (agency_id, invitation_id, actor_id, subject_user_id, event_type)
    values (invitation.agency_id, invitation.id, p_actor_id, p_actor_id, 'expired');
    return jsonb_build_object('ok', false, 'status', 'expired', 'agency_id', invitation.agency_id);
  end if;
  if p_action = 'decline' then
    update public.agency_member_invitations set status = 'declined', responded_at = now() where id = invitation.id;
    insert into public.agency_member_access_events (agency_id, invitation_id, actor_id, subject_user_id, event_type)
    values (invitation.agency_id, invitation.id, p_actor_id, p_actor_id, 'declined');
    return jsonb_build_object('ok', true, 'status', 'declined', 'agency_id', invitation.agency_id);
  end if;
  if p_action <> 'accept' then
    raise exception using errcode = 'P0001', message = 'Choose accept or decline.';
  end if;
  select * into page_row from public.agencies where id = invitation.agency_id for update;
  if not found or page_row.owner_id = p_actor_id then
    raise exception using errcode = 'P0001', message = 'This invitation is no longer valid for this Rental Page.';
  end if;
  if exists (select 1 from public.agency_members where agency_id = invitation.agency_id and user_id = p_actor_id) then
    raise exception using errcode = 'P0001', message = 'You already have access to this Rental Page.';
  end if;
  select count(*)::integer into used_slots from public.agency_members where agency_id = invitation.agency_id;
  if used_slots >= 25 then
    raise exception using errcode = 'P0001', message = 'This Rental Page team is full. Ask the owner to make space and send a new invitation.';
  end if;
  insert into public.agency_members (agency_id, user_id, role, invited_by, invited_email)
  values (invitation.agency_id, p_actor_id, invitation.role, invitation.invited_by, invitation.invited_email);
  update public.agency_member_invitations set status = 'accepted', responded_at = now() where id = invitation.id;
  insert into public.agency_member_access_events (agency_id, invitation_id, actor_id, subject_user_id, event_type)
  values (invitation.agency_id, invitation.id, p_actor_id, p_actor_id, 'accepted');
  return jsonb_build_object('ok', true, 'status', 'accepted', 'agency_id', invitation.agency_id, 'owner_id', page_row.owner_id, 'invited_by', invitation.invited_by);
end;
$$;

create or replace function public.cancel_agency_member_invitation(
  p_invitation_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  invitation public.agency_member_invitations%rowtype;
begin
  select * into invitation from public.agency_member_invitations where id = p_invitation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Invitation not found.'; end if;
  if not exists (select 1 from public.agencies where id = invitation.agency_id and owner_id = p_owner_id) then
    raise exception using errcode = '42501', message = 'Only the Rental Page owner can cancel this invitation.';
  end if;
  if invitation.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'This invitation is no longer pending.';
  end if;
  update public.agency_member_invitations set status = 'cancelled', responded_at = now() where id = invitation.id;
  insert into public.agency_member_access_events (agency_id, invitation_id, actor_id, subject_user_id, event_type)
  values (invitation.agency_id, invitation.id, p_owner_id, invitation.invitee_id, 'cancelled');
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

create or replace function public.remove_agency_member(
  p_agency_id uuid,
  p_actor_id uuid,
  p_member_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_owner_id uuid;
  removed boolean := false;
begin
  select owner_id into page_owner_id from public.agencies where id = p_agency_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rental Page not found.';
  end if;
  if p_actor_id <> page_owner_id and p_actor_id <> p_member_user_id then
    raise exception using errcode = '42501', message = 'You cannot remove that person from this Rental Page.';
  end if;

  delete from public.agency_members
  where agency_id = p_agency_id and user_id = p_member_user_id
  returning true into removed;
  if not found then
    raise exception using errcode = 'P0002', message = 'That person is not an active Rental Page staff member.';
  end if;

  insert into public.agency_member_access_events (agency_id, actor_id, subject_user_id, event_type, metadata)
  values (
    p_agency_id,
    p_actor_id,
    p_member_user_id,
    'removed',
    jsonb_build_object('removed_by_self', p_actor_id = p_member_user_id)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.expire_agency_member_invitations()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  expired_count integer;
begin
  with expired as (
    update public.agency_member_invitations
    set status = 'expired', responded_at = now()
    where status = 'pending' and expires_at <= now()
    returning id, agency_id, invitee_id
  ), events as (
    insert into public.agency_member_access_events (agency_id, invitation_id, subject_user_id, event_type)
    select agency_id, id, invitee_id, 'expired' from expired
    returning 1
  )
  select count(*)::integer into expired_count from events;
  return coalesce(expired_count, 0);
end;
$$;

revoke all on function public.create_agency_member_invitation(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.respond_to_agency_member_invitation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_agency_member_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_agency_member(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_agency_member_invitations() from public, anon, authenticated;
grant execute on function public.create_agency_member_invitation(uuid, uuid, uuid, text) to service_role;
grant execute on function public.respond_to_agency_member_invitation(uuid, uuid, text) to service_role;
grant execute on function public.cancel_agency_member_invitation(uuid, uuid) to service_role;
grant execute on function public.remove_agency_member(uuid, uuid, uuid) to service_role;
grant execute on function public.expire_agency_member_invitations() to service_role;
