-- 114 - Keep the booking chat and its database policy in agreement.
--
-- The interface keeps chat writable for the 30-day post-return records window
-- because fines and tolls can arrive after the 72-hour damage-claim deadline.
-- Migration 098 still rejected every message as soon as a booking completed,
-- so the composer looked usable while the database refused the send.

drop policy if exists "Booking parties send messages" on public.booking_messages;
create policy "Booking parties send messages" on public.booking_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_messages.booking_id
        and b.status <> all (
          array[
            'declined'::public.booking_status,
            'cancelled'::public.booking_status
          ]
        )
        and (
          b.status <> 'completed'::public.booking_status
          or (
            b.completed_at is not null
            and b.completed_at >= now() - interval '30 days'
          )
        )
        and (
          b.renter_id = auth.uid()
          or public.has_page_capability(b.agency_id, 'communicate')
        )
    )
  );
