#!/usr/bin/env node
/*
 * Booking requests the owner never answers close on their own.
 *
 * The rule (migration 130, lib/booking/request-expiry): a request closes at
 * whichever comes first, 24 hours after it was sent or its pickup time. The
 * owner is reminded 6 hours before when the window is long enough. Requests
 * long past their deadline close quietly. Confirmed bookings are never touched.
 *
 * This calls the database job directly, the same call the 15-minute cron makes,
 * so it needs migration 130 applied but no dev server. Note that the job also
 * processes any real requests that are past their deadline: exactly what the
 * cron does in production.
 *
 * Test phone numbers use +999, an unassigned country code, so no queued text
 * can reach a real person; every queued row is removed at the end anyway.
 *
 * Usage: node scripts/verify-request-expiry.mjs
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "Requestexpiry-1!";
const stamp = Date.now().toString(36);
const digits = String(Date.now()).slice(-7);
const NO_REPLY_REASON = "No reply from the owner in time";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let ok = true;
const chk = (l, c, x = "") => { if (!c) ok = false; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "   " + x : ""}`); };
const made = { users: [], agencies: [], vehicles: [], bookings: [] };

const HOUR = 3_600_000;
/** Sri Lanka date and time for a moment, the way bookings store pickup. */
function slParts(ms) {
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

async function makeUser(tag, phone, patch = {}) {
  const email = `expiry-${tag}-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Expiry ${tag}` },
  });
  if (error) throw error;
  made.users.push(data.user.id);
  await service.from("profiles").update({ phone, full_name: `Expiry ${tag}` }).eq("id", data.user.id);
  await service.from("profiles").update({ phone_verified: true, kyc_status: "verified", ...patch }).eq("id", data.user.id);
  return data.user.id;
}

/**
 * A request with a chosen age and pickup. `sentHoursAgo` backdates created_at;
 * `pickupInHours` may be negative (pickup already passed).
 */
async function makeRequest(label, { sentHoursAgo, pickupInHours, days = 2, status = "pending_confirmation" }) {
  const pickup = slParts(Date.now() + pickupInHours * HOUR);
  const back = slParts(Date.now() + (pickupInHours + days * 24) * HOUR);
  const { data, error } = await service.from("bookings").insert({
    vehicle_id: ctx.vehicleId, agency_id: ctx.pageId, renter_id: ctx.renterId,
    start_date: pickup.date, end_date: back.date, start_time: pickup.time, end_time: pickup.time,
    daily_rate_lkr: 6500, booking_fee_lkr: 0, status,
  }).select("id").single();
  if (error) throw new Error(`${label}: ${error.message}`);
  made.bookings.push(data.id);
  const { error: backdateError } = await service.from("bookings")
    .update({ created_at: new Date(Date.now() - sentHoursAgo * HOUR).toISOString() })
    .eq("id", data.id);
  if (backdateError) throw new Error(`${label} backdate: ${backdateError.message}`);
  return data.id;
}

const state = async (id) => (await service.from("bookings").select("status, cancellation_reason").eq("id", id).single()).data;
const outboxKeys = async (id) =>
  ((await service.from("notification_outbox").select("event_key, text_body").eq("booking_id", id)).data ?? []);

const ctx = {};
try {
  const { error: fnError } = await service.rpc("expire_unanswered_booking_requests");
  if (fnError) throw new Error("Migration 130 is not applied: " + fnError.message);

  const ownerId = await makeUser("owner", `+99911${digits}`);
  ctx.renterId = await makeUser("renter", `+99912${digits}`);

  const { data: page, error: pageError } = await service.from("agencies").insert({
    owner_id: ownerId, name: `Expiry Rentals ${stamp}`, slug: `expiry-${stamp}`,
    city: "Colombo", whatsapp_number: `+99911${digits}`, page_type: "personal",
    is_verified: true, whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (pageError) throw pageError;
  made.agencies.push(page.id);
  ctx.pageId = page.id;

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: page.id, make: "Suzuki", model: "Wagon R", year: 2018,
    vehicle_type: "car", transmission: "automatic", seats: 4, fuel_type: "petrol",
    city: "Colombo", daily_rate_lkr: 6500, slug: `expiry-wagonr-${stamp}`,
    plate_number: `CEX ${digits.slice(-4)}`, insurance_type: "hire",
    self_drive: true, with_driver: false, doors: 4, engine_cc: 660,
    photos: [1, 2, 3, 4].map((i) => `https://example.invalid/expiry-${stamp}-${i}.jpg`),
    status: "unlisted",
  }).select("id").single();
  if (vehicleError) throw vehicleError;
  made.vehicles.push(vehicle.id);
  ctx.vehicleId = vehicle.id;

  const pastWindow  = await makeRequest("past 24 hours",  { sentHoursAgo: 24.2, pickupInHours: 120 });
  const pickupGone  = await makeRequest("pickup passed",  { sentHoursAgo: 1,    pickupInHours: -0.3 });
  const fresh       = await makeRequest("fresh",          { sentHoursAgo: 2,    pickupInHours: 72 });
  const dueReminder = await makeRequest("reminder due",   { sentHoursAgo: 20,   pickupInHours: 72 });
  const shortWindow = await makeRequest("short window",   { sentHoursAgo: 1,    pickupInHours: 3 });
  const backlog     = await makeRequest("backlog",        { sentHoursAgo: 72,   pickupInHours: 240 });
  const confirmed   = await makeRequest("confirmed",      { sentHoursAgo: 72,   pickupInHours: 200, status: "confirmed" });

  // A new request queues the owner a "new request" text. Clear those so the
  // checks below only see what the job queued.
  await service.from("notification_outbox").delete().in("booking_id", made.bookings);

  const { data: first, error: runError } = await service.rpc("expire_unanswered_booking_requests");
  if (runError) throw runError;
  const { error: secondRunError } = await service.rpc("expire_unanswered_booking_requests");
  if (secondRunError) throw secondRunError;
  console.log("job result:", JSON.stringify(first));

  // ── Closing ──
  let s = await state(pastWindow);
  chk("closes a request unanswered for 24 hours", s.status === "declined" && s.cancellation_reason === NO_REPLY_REASON, `${s.status}`);
  s = await state(pickupGone);
  chk("closes a request whose pickup time has passed", s.status === "declined", s.status);
  chk("leaves a fresh request open", (await state(fresh)).status === "pending_confirmation");
  chk("leaves a request that still has time open", (await state(dueReminder)).status === "pending_confirmation");
  chk("never touches a confirmed booking", (await state(confirmed)).status === "confirmed");

  // ── What each side is told ──
  const pastKeys = await outboxKeys(pastWindow);
  const renterNote = pastKeys.find((k) => k.event_key.endsWith(":status:declined:renter"));
  chk("the renter is told the owner did not reply (not that they declined)",
    Boolean(renterNote) && /did not reply/.test(renterNote.text_body) && !/could not fulfil/.test(renterNote.text_body),
    renterNote?.text_body?.slice(0, 70) ?? "no renter text");
  chk("the owner is told the request closed",
    pastKeys.some((k) => k.event_key.endsWith(":status:no-reply:page")));

  const backlogState = await state(backlog);
  chk("a request long past its deadline closes too", backlogState.status === "declined", backlogState.status);
  chk("but quietly, with no texts about a days-old request", (await outboxKeys(backlog)).length === 0);

  // ── Reminders ──
  const reminders = (await outboxKeys(dueReminder)).filter((k) => k.event_key.endsWith(":reply-reminder:page"));
  chk("the owner is reminded before the deadline", reminders.length === 1, String(reminders.length));
  chk("the reminder says when it closes", /closes at \d{1,2}:\d{2} (AM|PM) on \d{1,2} \w{3}/.test(reminders[0]?.text_body ?? ""),
    reminders[0]?.text_body?.slice(0, 90) ?? "");
  // The time quoted must be the real Sri Lanka time. Migration 130 read the
  // stored pickup as UTC and would have been 5.5 hours out (fixed in 132).
  const { data: dueRow } = await service.from("bookings").select("created_at").eq("id", dueReminder).single();
  const deadline = new Date(Date.parse(dueRow.created_at) + 24 * HOUR);
  const expectedTime = deadline.toLocaleTimeString("en-US", { timeZone: "Asia/Colombo", hour: "numeric", minute: "2-digit" });
  // Built by hand: Node writes September as "Sept", Postgres writes "Sep".
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const slDate = deadline.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }).split("-").map(Number);
  const expectedDay = `${slDate[2]} ${MONTHS[slDate[1] - 1]}`;
  const reminderText = reminders[0]?.text_body ?? "";
  chk("the reminder quotes the Sri Lanka closing time", reminderText.includes(`closes at ${expectedTime} on ${expectedDay}`),
    `expected "${expectedTime} on ${expectedDay}", got "${reminderText.match(/closes at [^.]*? if/)?.[0] ?? reminderText.slice(0, 60)}"`);
  chk("and only once, however often the job runs", reminders.length === 1);
  chk("no reminder when the whole window is short", (await outboxKeys(shortWindow)).length === 0);
  chk("no reminder for a fresh request", (await outboxKeys(fresh)).length === 0);

  // Both runs together: the second must not close or remind anything again.
  chk("the job reports what it did", typeof first?.closed === "number" && first.closed >= 2 && first.closed_quietly >= 1,
    JSON.stringify(first));
} catch (err) {
  ok = false;
  console.error("\nRUN FAILED:", err.message);
} finally {
  if (made.bookings.length) {
    await service.from("notification_outbox").delete().in("booking_id", made.bookings);
    await service.from("bookings").delete().in("id", made.bookings);
  }
  for (const id of made.vehicles) await service.from("vehicles").delete().eq("id", id);
  for (const id of made.agencies) await service.from("agencies").delete().eq("id", id);
  for (const id of made.users) {
    await service.from("activity_events").delete().eq("actor_id", id);
    await service.auth.admin.deleteUser(id);
  }
  console.log("\ncleaned up");
}

console.log(ok ? "\nREQUEST EXPIRY: unanswered requests close, owners are reminded, renters are told why." : "\nREQUEST EXPIRY: FAILED");
process.exit(ok ? 0 : 1);
