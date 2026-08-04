-- 059 — Lock booking writes entirely (SEC-004)
--
-- The renter/page UPDATE policies gated the row by ownership + status but not
-- by column, so a party could rewrite vehicle_id, renter_id, dates, prices,
-- fees, evidence stamps, deposit acknowledgements, or cancellation attribution
-- during an otherwise-allowed transition. bookings has NO genuinely
-- browser-owned column: every legitimate transition is server logic. So we
-- revoke browser UPDATE (and INSERT) entirely and route everything through
-- service-role server routes:
--   • creation                → POST /api/bookings              (already service)
--   • owner confirm/decline/complete/cancel → /api/bookings/transition
--   • renter slip / cancel / return-report  → /api/bookings/[id]/{slip,cancel,returned}
--   • admin slip / fee / transition         → /api/admin/bookings/*
--   • consent / messages / photos / inspections / cron → existing service routes
--
-- service_role is never named in the revoke, so all of the above keep working.

revoke update, insert on public.bookings from anon, authenticated;
