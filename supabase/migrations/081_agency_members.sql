-- 081 — Staff / team accounts on a Rental Page (PAGE-005 / GAP-021)
--
-- A big rental company is not one person. Until now every operational grant
-- was keyed to `agencies.owner_id = auth.uid()`, so only the account holder
-- could accept bookings, message renters, add vehicles, run inspections, etc.
-- This adds a members table so the owner can grant staff full operational
-- access to a page they don't own.
--
-- Design:
--   * agency_members(agency_id, user_id, role) — one row per staff member.
--     Row present = active access. Removal = row deleted. Owner is NOT stored
--     here (ownership stays on agencies.owner_id); this table is staff only.
--   * Two SECURITY DEFINER helpers return "agencies the current user may act
--     on" = owned ∪ member-of. Every owner-scoped RLS policy is rewritten to
--     use them. Because the helper set is a SUPERSET of {owned}, every owner
--     keeps exactly the access they had — the only new access is staff, and
--     with no member rows yet behaviour is byte-for-byte unchanged.
--   * Owner-only actions (add/remove staff, delete/transfer the page, verify
--     identity) stay keyed to owner_id in app code + column grants; managers
--     get everything operational, nothing structural.

-- ---------------------------------------------------------------------------
-- Members table
-- ---------------------------------------------------------------------------
create table if not exists public.agency_members (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'manager' check (role in ('manager')),
  invited_by   uuid references public.profiles(id) on delete set null,
  invited_email text,
  created_at   timestamptz not null default now(),
  unique (agency_id, user_id)
);

create index if not exists idx_agency_members_user   on public.agency_members(user_id);
create index if not exists idx_agency_members_agency on public.agency_members(agency_id);

alter table public.agency_members enable row level security;

-- Browsers may READ memberships (to build the page switcher and the owner's
-- member list); all writes go through the service client in the members API
-- after an explicit owner check, so no insert/update/delete grants here.
revoke all on public.agency_members from anon, authenticated;
grant select on public.agency_members to authenticated;
grant all on public.agency_members to service_role;

-- ---------------------------------------------------------------------------
-- Helpers: the set of agencies the current user may operate.
-- SECURITY DEFINER so they bypass RLS on agencies/agency_members internally
-- (prevents recursive policy evaluation); search_path pinned for safety.
-- ---------------------------------------------------------------------------
create or replace function public.acting_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.agencies where owner_id = auth.uid()
  union
  select agency_id from public.agency_members where user_id = auth.uid()
$$;

create or replace function public.can_act_on_agency(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.agencies where id = a_id and owner_id = auth.uid())
      or exists (select 1 from public.agency_members where agency_id = a_id and user_id = auth.uid());
$$;

grant execute on function public.acting_agency_ids() to authenticated;
grant execute on function public.can_act_on_agency(uuid) to authenticated;

-- agency_members RLS: you can see membership rows for any agency you can act
-- on (your own row is covered because your agency is in your acting set).
create policy "Members visible to the page team"
  on public.agency_members for select
  using (agency_id in (select public.acting_agency_ids()));

-- ---------------------------------------------------------------------------
-- Agencies: let staff READ and edit page details of pages they belong to.
-- The owner ALL policy stays; column grants (057) already stop anyone from
-- touching is_verified / owner_id / moderation columns, and deleted_at is not
-- grantable so staff cannot delete the page.
-- ---------------------------------------------------------------------------
create policy "Members read their agency"
  on public.agencies for select
  using (id in (select public.acting_agency_ids()));

create policy "Members update their agency"
  on public.agencies for update
  using (id in (select public.acting_agency_ids()))
  with check (id in (select public.acting_agency_ids()));

-- ---------------------------------------------------------------------------
-- Rewrite every owner-scoped policy to the acting-set helper.
-- Each DROP/CREATE reproduces the prior logic verbatim except the owner
-- subquery, which becomes `select public.acting_agency_ids()`.
-- ---------------------------------------------------------------------------

-- activity_events
drop policy if exists "Agency owners see own activity" on public.activity_events;
create policy "Agency team sees own activity"
  on public.activity_events for select
  using (related_agency_id in (select public.acting_agency_ids()));

-- agency_penalties
drop policy if exists "Agency sees their own penalties" on public.agency_penalties;
create policy "Agency team sees their own penalties"
  on public.agency_penalties for select
  using (agency_id in (select public.acting_agency_ids()));

-- booking_agreements
drop policy if exists "Booking parties read agreement" on public.booking_agreements;
create policy "Booking parties read agreement"
  on public.booking_agreements for select
  using (exists (select 1 from public.bookings b
                 where b.id = booking_agreements.booking_id
                   and (b.renter_id = auth.uid()
                        or b.agency_id in (select public.acting_agency_ids()))));

-- booking_charges
drop policy if exists "Booking parties read charges" on public.booking_charges;
create policy "Booking parties read charges"
  on public.booking_charges for select
  using ((exists (select 1 from public.bookings b
                  where b.id = booking_charges.booking_id
                    and (b.renter_id = auth.uid()
                         or b.agency_id in (select public.acting_agency_ids()))))
         or (exists (select 1 from public.profiles
                     where profiles.id = auth.uid() and profiles.role = 'admin'::user_role)));

-- booking_inspections (read / update / insert)
drop policy if exists "Booking parties read inspections" on public.booking_inspections;
create policy "Booking parties read inspections"
  on public.booking_inspections for select
  using (exists (select 1 from public.bookings b
                 where b.id = booking_inspections.booking_id
                   and (b.renter_id = auth.uid()
                        or b.agency_id in (select public.acting_agency_ids()))));

drop policy if exists "Booking parties update inspections" on public.booking_inspections;
create policy "Booking parties update inspections"
  on public.booking_inspections for update
  using (exists (select 1 from public.bookings b
                 where b.id = booking_inspections.booking_id
                   and (b.renter_id = auth.uid()
                        or b.agency_id in (select public.acting_agency_ids()))));

drop policy if exists "Page side submits inspections" on public.booking_inspections;
create policy "Page side submits inspections"
  on public.booking_inspections for insert
  with check ((submitted_by = auth.uid())
              and exists (select 1 from public.bookings b
                          where b.id = booking_inspections.booking_id
                            and b.agency_id in (select public.acting_agency_ids())));

-- booking_messages (read / send)
drop policy if exists "Booking parties read messages" on public.booking_messages;
create policy "Booking parties read messages"
  on public.booking_messages for select
  using (exists (select 1 from public.bookings b
                 where b.id = booking_messages.booking_id
                   and (b.renter_id = auth.uid()
                        or b.agency_id in (select public.acting_agency_ids()))));

drop policy if exists "Booking parties send messages" on public.booking_messages;
create policy "Booking parties send messages"
  on public.booking_messages for insert
  with check ((sender_id = auth.uid())
              and exists (select 1 from public.bookings b
                          where b.id = booking_messages.booking_id
                            and (b.status <> all (array['completed'::booking_status,'declined'::booking_status,'cancelled'::booking_status]))
                            and (b.renter_id = auth.uid()
                                 or b.agency_id in (select public.acting_agency_ids()))));

-- bookings (transition / select)
drop policy if exists "Agency can transition booking" on public.bookings;
create policy "Agency can transition booking"
  on public.bookings for update
  using ((agency_id in (select public.acting_agency_ids()))
         and (status = any (array['pending_confirmation'::booking_status,'payment_pending'::booking_status,'confirmed'::booking_status,'active'::booking_status])))
  with check ((agency_id in (select public.acting_agency_ids()))
              and (status = any (array['pending_confirmation'::booking_status,'payment_pending'::booking_status,'confirmed'::booking_status,'active'::booking_status,'completed'::booking_status,'declined'::booking_status,'cancelled'::booking_status])));

drop policy if exists "Agency sees bookings for their vehicles" on public.bookings;
create policy "Agency sees bookings for their vehicles"
  on public.bookings for select
  using (agency_id in (select public.acting_agency_ids()));

-- incidents (file / read)
drop policy if exists "Booking parties file incidents" on public.incidents;
create policy "Booking parties file incidents"
  on public.incidents for insert
  with check ((filed_by = auth.uid())
              and exists (select 1 from public.bookings b
                          where b.id = incidents.booking_id
                            and (b.renter_id = auth.uid()
                                 or b.agency_id in (select public.acting_agency_ids()))));

drop policy if exists "Booking parties read incidents" on public.incidents;
create policy "Booking parties read incidents"
  on public.incidents for select
  using (exists (select 1 from public.bookings b
                 where b.id = incidents.booking_id
                   and (b.renter_id = auth.uid()
                        or b.agency_id in (select public.acting_agency_ids()))));

-- reviews (insert) — renter-side branch unchanged; agency-side branch widened
drop policy if exists "Can only review completed bookings you were part of" on public.reviews;
create policy "Can only review completed bookings you were part of"
  on public.reviews for insert
  with check ((auth.uid() = reviewer_id)
              and exists (select 1 from public.bookings b
                          where b.id = reviews.booking_id
                            and b.status = 'completed'::booking_status
                            and (((b.renter_id = auth.uid())
                                  and (reviews.reviewee_id = (select agencies.owner_id from public.agencies where agencies.id = b.agency_id)))
                                 or ((b.agency_id in (select public.acting_agency_ids()))
                                     and (reviews.reviewee_id = b.renter_id)))));

-- support_messages (read / insert)
drop policy if exists "Read accessible support messages" on public.support_messages;
create policy "Read accessible support messages"
  on public.support_messages for select
  using ((thread_id in (select t.id from public.support_threads t
                        where t.agency_id in (select public.acting_agency_ids())))
         or (thread_id in (select support_threads.id from public.support_threads
                           where support_threads.renter_id = auth.uid()))
         or (exists (select 1 from public.profiles
                     where profiles.id = auth.uid() and profiles.role = 'admin'::user_role)));

drop policy if exists "Insert into accessible thread" on public.support_messages;
create policy "Insert into accessible thread"
  on public.support_messages for insert
  with check ((sender_id = auth.uid())
              and ((thread_id in (select t.id from public.support_threads t
                                  where t.agency_id in (select public.acting_agency_ids())))
                   or (thread_id in (select support_threads.id from public.support_threads
                                     where support_threads.renter_id = auth.uid()))
                   or (exists (select 1 from public.profiles
                               where profiles.id = auth.uid() and profiles.role = 'admin'::user_role))));

-- support_threads
drop policy if exists "Agency owner manages own thread" on public.support_threads;
create policy "Agency team manages own thread"
  on public.support_threads for all
  using (agency_id in (select public.acting_agency_ids()));

-- vehicle_blocks
drop policy if exists "Agency owner manages own blocks" on public.vehicle_blocks;
create policy "Agency team manages own blocks"
  on public.vehicle_blocks for all
  using (exists (select 1 from public.vehicles v
                 where v.id = vehicle_blocks.vehicle_id
                   and v.agency_id in (select public.acting_agency_ids())))
  with check (exists (select 1 from public.vehicles v
                      where v.id = vehicle_blocks.vehicle_id
                        and v.agency_id in (select public.acting_agency_ids())));

-- vehicle_documents
drop policy if exists "Owner manages own vehicle documents" on public.vehicle_documents;
create policy "Team manages own vehicle documents"
  on public.vehicle_documents for all
  using (vehicle_id in (select v.id from public.vehicles v
                        where v.agency_id in (select public.acting_agency_ids())))
  with check (vehicle_id in (select v.id from public.vehicles v
                             where v.agency_id in (select public.acting_agency_ids())));

-- vehicles — keep the launch gate (page verified + OWNER kyc verified), but
-- allow any acting user (owner or staff), not only the owner.
drop policy if exists "Agency owner can manage their vehicles" on public.vehicles;
create policy "Agency team can manage their vehicles"
  on public.vehicles for all
  using (agency_id in (select a.id from public.agencies a
                       join public.profiles p on p.id = a.owner_id
                       where public.can_act_on_agency(a.id)
                         and a.is_verified = true
                         and p.kyc_status = 'verified'::kyc_status));
