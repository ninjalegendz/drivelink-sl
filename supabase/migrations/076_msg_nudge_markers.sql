-- 076 — Unread-message out-of-app nudge markers (MSG-004)
-- The 15-minute cron nudges a party (SMS/email) when the other party sent a
-- booking message they haven't opened. These markers stop it re-nudging for the
-- same message.
alter table public.bookings add column if not exists renter_msg_nudge_at timestamptz;
alter table public.bookings add column if not exists page_msg_nudge_at   timestamptz;
