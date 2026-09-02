-- The booking lifecycle loses its handover machinery.
--
-- DriveLink introduces the two parties and records what they agreed. It does
-- not inspect vehicles, hold agreements, run a deposit handshake or settle
-- accounts, so the database can no longer demand those things before a booking
-- may close. Two changes:
--
--   1. A confirmed booking can be closed directly by the Rental Page. There is
--      no "start rental" gate, because DriveLink is not present at the pickup.
--   2. The handover and return prerequisite blocks are removed. They referenced
--      booking_agreements, booking_inspections, deposit confirmations and
--      settlement sign-off, none of which the product writes any more, so they
--      could only ever block a booking from closing.
--
-- `active` stays reachable and closeable so any row already in that state can
-- still be finished.

CREATE OR REPLACE FUNCTION public.transition_booking_lifecycle(p_booking_id uuid, p_actor_id uuid, p_to text, p_resolution_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  b public.bookings%rowtype;
  actor_role text;
  is_page_actor boolean := false;
  pickup public.booking_inspections%rowtype;
  return_report public.booking_inspections%rowtype;
  unresolved_count integer := 0;
  now_at timestamptz := now();
  clean_resolution_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
begin
  select * into b
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found.';
  end if;

  select role::text into actor_role
  from public.profiles
  where id = p_actor_id;

  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;

  if actor_role = 'admin' then
    if b.status::text = 'pending_confirmation' and p_to in ('confirmed', 'declined', 'cancelled') then
      null;
    elsif b.status::text = 'confirmed' and p_to = 'cancelled' then
      null;
    elsif b.status::text = 'disputed' and p_to in ('completed', 'cancelled') then
      if clean_resolution_note is null or length(clean_resolution_note) < 5 then
        raise exception using errcode = 'P0001', message = 'Add a clear resolution note before closing this dispute.';
      end if;
    else
      raise exception using errcode = 'P0001', message = format('That admin change is not allowed from %s to %s.', b.status::text, p_to);
    end if;
  else
    if not is_page_actor then
      raise exception using errcode = '42501', message = 'You cannot manage this booking.';
    end if;

    if not (
      (b.status::text = 'pending_confirmation' and p_to in ('confirmed', 'declined'))
      -- DriveLink is not part of the handover, so there is no inspection-gated
      -- "start rental" step. A confirmed booking is closed by the owner once
      -- the vehicle is back, which is what opens reviews and reliability.
      or (b.status::text = 'confirmed' and p_to in ('completed', 'active'))
      or (b.status::text = 'active' and p_to = 'completed')
    ) then
      raise exception using errcode = 'P0001', message = format('That change is not allowed from %s to %s.', b.status::text, p_to);
    end if;
  end if;



  if actor_role = 'admin' and b.status::text = 'disputed' then
    update public.incidents
    set status = 'resolved',
        resolved_by = p_actor_id,
        resolved_at = now_at,
        resolution_note = clean_resolution_note
    where booking_id = b.id
      and status in ('open', 'awaiting_response', 'escalated');

    insert into public.activity_events (
      actor_id, actor_role, event_type, subject_kind, subject_id,
      related_renter_id, related_agency_id, related_booking_id, metadata
    ) values (
      p_actor_id, 'admin', 'booking.dispute_resolved_by_admin', 'booking', b.id,
      b.renter_id, b.agency_id, b.id,
      jsonb_build_object('from_status', b.status::text, 'to_status', p_to, 'resolution_note', clean_resolution_note)
    );
  end if;

  update public.bookings
  set status = p_to::public.booking_status,
      confirmed_at = case when p_to = 'confirmed' then now_at else confirmed_at end,
      activated_at = case when p_to = 'active' then now_at else activated_at end,
      declined_at = case when p_to = 'declined' then now_at else declined_at end,
      completed_at = case when p_to = 'completed' then now_at else completed_at end,
      return_confirmed_at = case when p_to = 'completed' then now_at else return_confirmed_at end,
      cancelled_at = case when p_to = 'cancelled' then now_at else cancelled_at end,
      cancelled_by = case when p_to = 'cancelled' and actor_role = 'admin' then 'system' else cancelled_by end,
      cancellation_reason = case
        when p_to = 'cancelled' and actor_role = 'admin' and clean_resolution_note is not null
          then 'Closed by DriveLink after review: ' || clean_resolution_note
        else cancellation_reason
      end
  where id = b.id;

  return jsonb_build_object('ok', true, 'previousStatus', b.status::text, 'newStatus', p_to);
end;
$function$
;
