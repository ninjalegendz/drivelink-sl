-- 057 — Lock protected agency (Rental Page) columns (SEC-003)
--
-- "Owner can manage their agency" is a FOR ALL policy with no column limit,
-- so a page owner could set is_verified=true, is_blocked=false, or edit
-- reliability / strike / cancellation counters on their own page. Column-level
-- grants restrict the browser (authenticated) to genuinely owner-editable
-- fields; moderation columns are service-role only. Page creation moved to the
-- service client (api/pages), so browsers no longer INSERT agencies at all.
--
-- Admin verify/block and the block→unlist cascade now run through
-- /api/admin/agencies/[id] on the service client.

revoke update, insert on public.agencies from anon, authenticated;

grant update (
  name,
  description,
  address,
  city,
  whatsapp_number,
  email,
  logo_url,
  cover_url,
  business_hours,
  business_reg_no,
  business_reg_url,
  sms_notifications_enabled,
  whatsapp_notifications_enabled
) on public.agencies to authenticated;
