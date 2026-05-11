-- ============================================================
-- Activity log — per-user timeline of everything that happened
-- ============================================================
-- One table, one shape. Each event has:
--   - actor (who did it) + actor_role
--   - event_type (e.g. "booking.confirmed", "admin.rating_adjusted")
--   - subject (what was acted on)
--   - related_renter_id / related_agency_id / related_booking_id
--     cross-reference indexes so the admin user/agency timeline pages
--     resolve to fast index lookups
--   - metadata jsonb for event-specific details
--
-- Hybrid logging strategy:
--   - DB trigger on bookings: covers the lifecycle (created + every
--     status flip) since those happen via many code paths
--   - App-level logEvent() calls: cover admin actions (rating adjust,
--     block/unblock, edit, delete) where we want explicit actor_id
--     and a human reason
-- ============================================================

create table if not exists activity_events (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references profiles(id),
  actor_role      text check (actor_role in ('renter', 'agency_owner', 'admin', 'system')),
  event_type      text not null,
  subject_kind    text not null check (subject_kind in ('renter', 'agency', 'booking', 'vehicle')),
  subject_id      uuid not null,
  related_renter_id  uuid,
  related_agency_id  uuid,
  related_booking_id uuid,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_activity_renter
  on activity_events(related_renter_id, created_at desc);
create index if not exists idx_activity_agency
  on activity_events(related_agency_id, created_at desc);
create index if not exists idx_activity_booking
  on activity_events(related_booking_id, created_at desc);
create index if not exists idx_activity_subject
  on activity_events(subject_kind, subject_id, created_at desc);

alter table activity_events enable row level security;

drop policy if exists "Admins see all activity"           on activity_events;
drop policy if exists "Renters see own activity"          on activity_events;
drop policy if exists "Agency owners see own activity"    on activity_events;
drop policy if exists "Service inserts activity"          on activity_events;

create policy "Admins see all activity"
  on activity_events for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Renters see own activity"
  on activity_events for select using (related_renter_id = auth.uid());

create policy "Agency owners see own activity"
  on activity_events for select using (
    related_agency_id in (select id from agencies where owner_id = auth.uid())
  );

-- ─── Booking-lifecycle trigger ────────────────────────────────
-- Logs INSERT and every status flip on bookings. Actor is best-effort:
-- the trigger can read auth.uid() when the change came through the
-- cookie-based client (renter or agency), but service-role writes
-- (booking-create API, cron) come through with auth.uid() = null and
-- get attributed to 'system'. App-level logEvent() calls handle
-- finer-grained attribution where it matters.
create or replace function log_booking_lifecycle()
returns trigger language plpgsql as $$
declare
  acting_uid uuid;
  acting_role text;
begin
  acting_uid := auth.uid();
  if acting_uid is not null then
    select role into acting_role from profiles where id = acting_uid;
  else
    acting_role := 'system';
  end if;

  if TG_OP = 'INSERT' then
    insert into activity_events (
      actor_id, actor_role, event_type,
      subject_kind, subject_id,
      related_renter_id, related_agency_id, related_booking_id,
      metadata
    ) values (
      coalesce(acting_uid, new.renter_id),
      coalesce(acting_role, 'renter'),
      'booking.created',
      'booking', new.id,
      new.renter_id, new.agency_id, new.id,
      jsonb_build_object(
        'vehicle_id', new.vehicle_id,
        'start_date', new.start_date,
        'end_date',   new.end_date,
        'days',       new.total_days
      )
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into activity_events (
      actor_id, actor_role, event_type,
      subject_kind, subject_id,
      related_renter_id, related_agency_id, related_booking_id,
      metadata
    ) values (
      acting_uid, coalesce(acting_role, 'system'),
      'booking.' || new.status,
      'booking', new.id,
      new.renter_id, new.agency_id, new.id,
      jsonb_build_object(
        'from_status', old.status,
        'to_status',   new.status,
        'reason',      new.cancellation_reason
      )
    );
  end if;

  return new;
end $$;

drop trigger if exists trg_log_booking_lifecycle on bookings;
create trigger trg_log_booking_lifecycle
  after insert or update on bookings
  for each row execute function log_booking_lifecycle();
