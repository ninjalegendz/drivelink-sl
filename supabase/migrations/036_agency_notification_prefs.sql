-- ============================================================
-- Per-agency notification preferences
-- ============================================================
-- Two independent toggles for the booking-request alert channels.
-- Default true so existing agencies keep current behavior — the realtime
-- dashboard toast remains regardless of these flags.
-- ============================================================

alter table public.agencies
  add column sms_notifications_enabled       boolean not null default true,
  add column whatsapp_notifications_enabled  boolean not null default true;

-- Keep the anon column allowlist tight — these prefs are internal and
-- not part of the public agency profile. Authenticated already has full
-- select/update on the row.
