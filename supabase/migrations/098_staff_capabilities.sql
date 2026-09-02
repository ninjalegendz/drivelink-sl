-- 098 - Least-access Rental Page staff roles.
--
-- Existing managers keep their current operational access. New invitations
-- default to the narrower booking-agent role and every API/RLS path resolves a
-- named capability rather than treating any membership row as full control.

alter table public.agency_members drop constraint if exists agency_members_role_check;
alter table public.agency_members add constraint agency_members_role_check
  check (role in ('manager', 'booking_agent', 'handover_agent', 'fleet_editor', 'support_agent'));
alter table public.agency_member_invitations drop constraint if exists agency_member_invitations_role_check;
alter table public.agency_member_invitations add constraint agency_member_invitations_role_check
  check (role in ('manager', 'booking_agent', 'handover_agent', 'fleet_editor', 'support_agent'));
alter table public.agency_member_invitations alter column role set default 'booking_agent';

alter table public.agency_member_access_events drop constraint if exists agency_member_access_events_event_type_check;
alter table public.agency_member_access_events add constraint agency_member_access_events_event_type_check
  check (event_type in ('invited', 'accepted', 'declined', 'cancelled', 'expired', 'removed', 'role_changed'));

create or replace function public.has_page_capability(p_agency_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.agencies a
    where a.id = p_agency_id and a.owner_id = auth.uid()
  ) or exists (
    select 1
    from public.agency_members m
    where m.agency_id = p_agency_id
      and m.user_id = auth.uid()
      and (
        m.role = 'manager'
        or (p_capability = 'view_page' and m.role in ('booking_agent','handover_agent','fleet_editor','support_agent'))
        or (p_capability = 'view_bookings' and m.role in ('booking_agent','handover_agent','support_agent'))
        or (p_capability = 'manage_booking' and m.role = 'booking_agent')
        or (p_capability = 'communicate' and m.role in ('booking_agent','handover_agent','support_agent'))
        or (p_capability = 'manage_handover' and m.role = 'handover_agent')
        or (p_capability = 'manage_fleet' and m.role = 'fleet_editor')
        or (p_capability = 'manage_support' and m.role = 'support_agent')
        or (p_capability = 'view_documents' and m.role in ('booking_agent','handover_agent'))
      )
  );
$$;

grant execute on function public.has_page_capability(uuid, text) to authenticated;

-- The existing four-argument function remains for one deployment window and
-- any old clients. It now creates the safe default because it does not name a
-- role. The five-argument version is the normal application entry point.
create or replace function public.create_agency_member_invitation(
  p_agency_id uuid,
  p_owner_id uuid,
  p_invitee_id uuid,
  p_invited_email text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare invitation jsonb; new_invitation_id uuid;
begin
  if p_role not in ('manager', 'booking_agent', 'handover_agent', 'fleet_editor', 'support_agent') then
    raise exception using errcode = 'P0001', message = 'Choose a valid Rental Page staff role.';
  end if;
  invitation := public.create_agency_member_invitation(p_agency_id, p_owner_id, p_invitee_id, p_invited_email);
  new_invitation_id := (invitation ->> 'id')::uuid;
  update public.agency_member_invitations set role = p_role where id = new_invitation_id;
  update public.agency_member_access_events
  set metadata = metadata || jsonb_build_object('role', p_role)
  where agency_member_access_events.invitation_id = new_invitation_id and event_type = 'invited';
  return invitation || jsonb_build_object('role', p_role);
end;
$$;

create or replace function public.set_agency_member_role(
  p_agency_id uuid,
  p_member_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare old_role text; documents_allowed boolean;
begin
  if p_role not in ('manager', 'booking_agent', 'handover_agent', 'fleet_editor', 'support_agent') then
    raise exception using errcode = 'P0001', message = 'Choose a valid Rental Page staff role.';
  end if;
  if not exists (select 1 from public.agencies a where a.id = p_agency_id and a.owner_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'Only the page owner can change staff roles.';
  end if;
  select role into old_role from public.agency_members
  where agency_id = p_agency_id and user_id = p_member_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Team member not found.'; end if;
  documents_allowed := p_role in ('manager', 'booking_agent', 'handover_agent');
  update public.agency_members
  set role = p_role,
      can_view_renter_documents = case when documents_allowed then can_view_renter_documents else false end,
      document_permission_granted_at = case when documents_allowed then document_permission_granted_at else null end
  where agency_id = p_agency_id and user_id = p_member_user_id;
  insert into public.agency_member_access_events (agency_id, actor_id, subject_user_id, event_type, metadata)
  values (p_agency_id, auth.uid(), p_member_user_id, 'role_changed', jsonb_build_object('from', old_role, 'to', p_role));
  return jsonb_build_object('ok', true, 'role', p_role);
end;
$$;

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
declare member_role text;
begin
  if not exists (select 1 from public.agencies a where a.id = p_agency_id and a.owner_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'Only the page owner can change document access.';
  end if;
  select role into member_role from public.agency_members
  where agency_id = p_agency_id and user_id = p_member_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Team member not found.'; end if;
  if p_enabled and member_role not in ('manager', 'booking_agent', 'handover_agent') then
    raise exception using errcode = 'P0001', message = 'This role does not need renter identity documents.';
  end if;
  update public.agency_members
  set can_view_renter_documents = p_enabled,
      document_permission_granted_at = case when p_enabled then now() else null end
  where agency_id = p_agency_id and user_id = p_member_user_id;
  insert into public.agency_member_permission_events (agency_id, member_user_id, changed_by, permission, enabled)
  values (p_agency_id, p_member_user_id, auth.uid(), 'view_renter_documents', p_enabled);
end;
$$;

revoke all on function public.create_agency_member_invitation(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_agency_member_invitation(uuid, uuid, uuid, text, text) to service_role;
revoke all on function public.set_agency_member_role(uuid, uuid, text) from public;
grant execute on function public.set_agency_member_role(uuid, uuid, text) to authenticated;
revoke all on function public.set_agency_member_document_permission(uuid, uuid, boolean) from public;
grant execute on function public.set_agency_member_document_permission(uuid, uuid, boolean) to authenticated;

-- Replace every broad membership policy from migration 081. Page owners pass
-- every capability, preserving their existing access; staff now pass only the
-- policy matching their explicit work role.
drop policy if exists "Members visible to the page team" on public.agency_members;
create policy "Members visible to themselves or page managers" on public.agency_members for select
  using (user_id = auth.uid() or public.has_page_capability(agency_id, 'manage_page'));

drop policy if exists "Members read their agency" on public.agencies;
create policy "Staff read their Rental Page" on public.agencies for select
  using (public.has_page_capability(id, 'view_page'));
drop policy if exists "Members update their agency" on public.agencies;
create policy "Managers update their Rental Page" on public.agencies for update
  using (public.has_page_capability(id, 'manage_page'))
  with check (public.has_page_capability(id, 'manage_page'));

drop policy if exists "Agency team sees own activity" on public.activity_events;
create policy "Managers see page activity" on public.activity_events for select
  using (public.has_page_capability(related_agency_id, 'view_analytics'));
drop policy if exists "Agency team sees their own penalties" on public.agency_penalties;
create policy "Managers see page penalties" on public.agency_penalties for select
  using (public.has_page_capability(agency_id, 'view_analytics'));

drop policy if exists "Booking parties read agreement" on public.booking_agreements;
create policy "Booking parties read agreement" on public.booking_agreements for select
  using (exists (select 1 from public.bookings b where b.id = booking_agreements.booking_id
                 and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'view_bookings'))));
drop policy if exists "Booking parties read charges" on public.booking_charges;
create policy "Booking parties read charges" on public.booking_charges for select
  using ((exists (select 1 from public.bookings b where b.id = booking_charges.booking_id
                 and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'manage_financial')))
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'::public.user_role)));

drop policy if exists "Booking parties read inspections" on public.booking_inspections;
create policy "Booking parties read inspections" on public.booking_inspections for select
  using (exists (select 1 from public.bookings b where b.id = booking_inspections.booking_id
                 and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'view_bookings'))));
drop policy if exists "Booking parties update inspections" on public.booking_inspections;
create policy "Booking parties update inspections" on public.booking_inspections for update
  using (exists (select 1 from public.bookings b where b.id = booking_inspections.booking_id
                 and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'manage_handover'))));
drop policy if exists "Page side submits inspections" on public.booking_inspections;
create policy "Handover staff submit inspections" on public.booking_inspections for insert
  with check (submitted_by = auth.uid() and exists (select 1 from public.bookings b
              where b.id = booking_inspections.booking_id and public.has_page_capability(b.agency_id, 'manage_handover')));

drop policy if exists "Booking parties read messages" on public.booking_messages;
create policy "Booking parties read messages" on public.booking_messages for select
  using (exists (select 1 from public.bookings b where b.id = booking_messages.booking_id
                 and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'communicate'))));
drop policy if exists "Booking parties send messages" on public.booking_messages;
create policy "Booking parties send messages" on public.booking_messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from public.bookings b
              where b.id = booking_messages.booking_id
                and b.status <> all (array['completed'::public.booking_status,'declined'::public.booking_status,'cancelled'::public.booking_status])
                and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'communicate'))));

drop policy if exists "Agency can transition booking" on public.bookings;
create policy "Managers and handover staff update page bookings" on public.bookings for update
  using (public.has_page_capability(agency_id, 'manage_handover')
         and status = any (array['pending_confirmation'::public.booking_status,'payment_pending'::public.booking_status,'confirmed'::public.booking_status,'active'::public.booking_status]))
  with check (public.has_page_capability(agency_id, 'manage_handover')
              and status = any (array['pending_confirmation'::public.booking_status,'payment_pending'::public.booking_status,'confirmed'::public.booking_status,'active'::public.booking_status,'completed'::public.booking_status,'declined'::public.booking_status,'cancelled'::public.booking_status]));
drop policy if exists "Agency sees bookings for their vehicles" on public.bookings;
create policy "Staff see assigned page bookings" on public.bookings for select
  using (public.has_page_capability(agency_id, 'view_bookings'));

drop policy if exists "Booking parties file incidents" on public.incidents;
create policy "Booking parties file incidents" on public.incidents for insert
  with check (filed_by = auth.uid() and exists (select 1 from public.bookings b where b.id = incidents.booking_id
              and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'manage_cases'))));
drop policy if exists "Booking parties read incidents" on public.incidents;
create policy "Booking parties read incidents" on public.incidents for select
  using (exists (select 1 from public.bookings b where b.id = incidents.booking_id
                 and (b.renter_id = auth.uid() or public.has_page_capability(b.agency_id, 'view_bookings'))));

drop policy if exists "Can only review completed bookings you were part of" on public.reviews;
create policy "Can only review completed bookings you were part of" on public.reviews for insert
  with check (auth.uid() = reviewer_id and exists (select 1 from public.bookings b where b.id = reviews.booking_id
              and b.status = 'completed'::public.booking_status
              and ((b.renter_id = auth.uid() and reviews.reviewee_id = (select a.owner_id from public.agencies a where a.id = b.agency_id))
                   or (public.has_page_capability(b.agency_id, 'manage_cases') and reviews.reviewee_id = b.renter_id))));

drop policy if exists "Read accessible support messages" on public.support_messages;
create policy "Read accessible support messages" on public.support_messages for select
  using (thread_id in (select t.id from public.support_threads t where public.has_page_capability(t.agency_id, 'manage_support'))
         or thread_id in (select t.id from public.support_threads t where t.renter_id = auth.uid())
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'::public.user_role));
drop policy if exists "Insert into accessible thread" on public.support_messages;
create policy "Insert into accessible thread" on public.support_messages for insert
  with check (sender_id = auth.uid() and (thread_id in (select t.id from public.support_threads t where public.has_page_capability(t.agency_id, 'manage_support'))
              or thread_id in (select t.id from public.support_threads t where t.renter_id = auth.uid())
              or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'::public.user_role)));
drop policy if exists "Agency team manages own thread" on public.support_threads;
create policy "Support staff manage page support thread" on public.support_threads for all
  using (public.has_page_capability(agency_id, 'manage_support'))
  with check (public.has_page_capability(agency_id, 'manage_support'));

drop policy if exists "Agency team manages own blocks" on public.vehicle_blocks;
create policy "Fleet staff manage vehicle blocks" on public.vehicle_blocks for all
  using (exists (select 1 from public.vehicles v where v.id = vehicle_blocks.vehicle_id and public.has_page_capability(v.agency_id, 'manage_fleet')))
  with check (exists (select 1 from public.vehicles v where v.id = vehicle_blocks.vehicle_id and public.has_page_capability(v.agency_id, 'manage_fleet')));
drop policy if exists "Team manages own vehicle documents" on public.vehicle_documents;
create policy "Fleet staff manage vehicle documents" on public.vehicle_documents for all
  using (vehicle_id in (select v.id from public.vehicles v where public.has_page_capability(v.agency_id, 'manage_fleet')))
  with check (vehicle_id in (select v.id from public.vehicles v where public.has_page_capability(v.agency_id, 'manage_fleet')));
drop policy if exists "Agency team can manage their vehicles" on public.vehicles;
create policy "Fleet staff manage page vehicles" on public.vehicles for all
  using (agency_id in (select a.id from public.agencies a join public.profiles p on p.id = a.owner_id
                       where public.has_page_capability(a.id, 'manage_fleet') and a.is_verified = true and p.kyc_status = 'verified'::public.kyc_status))
  with check (agency_id in (select a.id from public.agencies a join public.profiles p on p.id = a.owner_id
                            where public.has_page_capability(a.id, 'manage_fleet') and a.is_verified = true and p.kyc_status = 'verified'::public.kyc_status));
