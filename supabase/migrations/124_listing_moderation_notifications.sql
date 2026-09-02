-- An owner submits a listing and then hears nothing. Approval and rejection
-- both change what they can do next, and neither was announced: the only way
-- to learn the outcome was to log back in and read a badge. For someone who
-- arrived from an advert, silence reads as "this platform is not working".
--
-- Adds the admin on/off switch for that message, matching every other SMS
-- toggle in this table. Default true, so the notification is on from the
-- moment it ships; the switch exists to mute it, not to enable it.
alter table public.platform_settings
  add column if not exists sms_listing_moderation_enabled boolean not null default true;

comment on column public.platform_settings.sms_listing_moderation_enabled is
  'Notify a Rental Page when one of its listings is approved or rejected. Delivery cascades SMS (Sri Lankan numbers) then WhatsApp then email.';
