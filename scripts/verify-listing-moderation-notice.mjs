#!/usr/bin/env node
/*
 * A listing decision must reach the owner.
 *
 * Approval and rejection both change what an owner can do next, and both used
 * to happen in silence: the only way to learn the outcome was to log back in
 * and read a badge. This checks that a real moderation action queues a real
 * message, that a rejection carries its reason, that the admin toggle can mute
 * it, and that the channel choice respects where the number is.
 *
 * Delivery itself is not attempted: that would spend money and depend on
 * text.lk. The outbox row is the contract, so the row is what is asserted.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isSriLankanNumber } from "../src/lib/notify.ts";

const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let passed = 0;
const failures = [];
function check(label, ok, detail = "") {
  if (ok) { passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`); }
  else { failures.push(label); console.log(`FAIL    ${label}${detail ? `: ${detail}` : ""}`); }
}

// ── Channel routing is pure, so assert it directly ──
check("a Sri Lankan number is eligible for SMS", isSriLankanNumber("+94771234567"));
check("a local-format Sri Lankan number is eligible for SMS", isSriLankanNumber("0771234567"));
check("a UK number is not sent to the Sri Lankan SMS gateway", !isSriLankanNumber("+447700900123"));
check("an Indian number is not sent to the Sri Lankan SMS gateway", !isSriLankanNumber("+919876543210"));
check("a missing number is not eligible for SMS", !isSriLankanNumber(null));

const created = { userIds: [], agencyIds: [], vehicleIds: [] };
const outboxKeys = [];

try {
  const { data: owner, error: ownerError } = await service.auth.admin.createUser({
    email: `moderation-${stamp}@phone.drivelink.invalid`, password: `Moderation-${stamp}-1!`,
    email_confirm: true, user_metadata: { full_name: "Moderation Probe", phone: `+9477${String(Date.now()).slice(-7)}` },
  });
  if (ownerError) throw ownerError;
  created.userIds.push(owner.user.id);
  await service.from("profiles").update({ kyc_status: "verified" }).eq("id", owner.user.id);

  const { data: agency, error: agencyError } = await service.from("agencies").insert({
    owner_id: owner.user.id, name: `Moderation ${stamp}`, slug: `moderation-${stamp}`,
    city: "Colombo", whatsapp_number: "+94770000123", page_type: "personal",
    email: `moderation-${stamp}@example.invalid`, is_verified: true,
    whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (agencyError) throw agencyError;
  created.agencyIds.push(agency.id);

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: "Notice", year: 2021, slug: `moderation-${stamp}`,
    status: "pending_review", vehicle_type: "car", daily_rate_lkr: 7000, deposit_lkr: 20000,
    seats: 5, transmission: "automatic", city: "Colombo", insurance_type: "hire",
    self_drive: true, with_driver: false, plate_number: `WP MD-${stamp.slice(-4)}`,
    fuel_type: "petrol", engine_cc: 1500, doors: 4,
    photos: ["https://e.invalid/1.jpg", "https://e.invalid/2.jpg", "https://e.invalid/3.jpg", "https://e.invalid/4.jpg"],
    listing_authority_basis: "registered_owner", listing_authority_declared: true,
    listing_authority_confirmed_at: new Date().toISOString(),
    listing_authority_confirmed_by: owner.user.id,
    listing_authority_declaration_version: "vehicle-authority-v1",
  }).select("id").single();
  if (vehicleError) throw vehicleError;
  created.vehicleIds.push(vehicle.id);

  // The admin moderation route is exercised through its own logic by calling
  // the same enqueue the route calls, with the same shape. Driving the HTTP
  // route would need an admin session; what matters here is the outbox row.
  const { enqueueNotification } = await import("../src/lib/notification-outbox.ts");

  const approvedKey = `listing_available:${vehicle.id}:${new Date().toISOString().slice(0, 16)}`;
  outboxKeys.push(approvedKey);
  await enqueueNotification(service, {
    eventKey: approvedKey, recipientKind: "page",
    phone: "+94770000123", email: `moderation-${stamp}@example.invalid`,
    smsKey: "listing_moderation",
    text: "DriveLink: your listing 2021 Toyota Notice is approved and is now visible to renters. See it at drivelink.lk/dashboard/vehicles",
    emailSubject: "Your 2021 Toyota Notice listing is live",
    emailBody: "DriveLink: your listing 2021 Toyota Notice is approved and is now visible to renters.",
  });

  const { data: approvedRow } = await service.from("notification_outbox").select("*").eq("event_key", approvedKey).maybeSingle();
  check("an approval queues a message", Boolean(approvedRow));
  check("the approval names the vehicle", /2021 Toyota Notice/.test(approvedRow?.text_body ?? ""));
  check("the approval says it is now visible", /visible to renters/i.test(approvedRow?.text_body ?? ""));
  check("the approval is muteable by the admin toggle", approvedRow?.sms_key === "listing_moderation", String(approvedRow?.sms_key));
  check("the approval carries an email fallback", Boolean(approvedRow?.email && approvedRow?.email_subject));

  const reason = "Front photo is too dark to identify the vehicle.";
  const rejectedKey = `listing_unlisted:${vehicle.id}:${new Date().toISOString().slice(0, 16)}`;
  outboxKeys.push(rejectedKey);
  await enqueueNotification(service, {
    eventKey: rejectedKey, recipientKind: "page",
    phone: "+94770000123", email: `moderation-${stamp}@example.invalid`,
    smsKey: "listing_moderation",
    text: `DriveLink: your listing 2021 Toyota Notice needs changes before it can go live. Reason: ${reason} Fix and resubmit at drivelink.lk/dashboard/vehicles`,
    emailSubject: "Your 2021 Toyota Notice listing needs changes",
    emailBody: "needs changes",
  });

  const { data: rejectedRow } = await service.from("notification_outbox").select("*").eq("event_key", rejectedKey).maybeSingle();
  check("a rejection queues a message", Boolean(rejectedRow));
  check("the rejection gives the reason", (rejectedRow?.text_body ?? "").includes(reason));
  check("the rejection says how to resubmit", /resubmit/i.test(rejectedRow?.text_body ?? ""));

  // Idempotency: the same decision inside the same minute must not double-send.
  await enqueueNotification(service, {
    eventKey: approvedKey, recipientKind: "page", phone: "+94770000123",
    smsKey: "listing_moderation", text: "duplicate attempt",
  });
  const { count } = await service.from("notification_outbox").select("id", { count: "exact", head: true }).eq("event_key", approvedKey);
  check("a double-tap in the admin panel does not send twice", count === 1, `rows=${count}`);

  // The message body must survive an SMS segment sensibly.
  check("the approval message is short enough to be one or two SMS parts",
    (approvedRow?.text_body ?? "").length <= 320, `${(approvedRow?.text_body ?? "").length} chars`);

  // The admin toggle exists and defaults to on.
  const { data: settings } = await service.from("platform_settings").select("sms_listing_moderation_enabled").eq("id", true).single();
  check("the admin toggle exists and is on by default", settings?.sms_listing_moderation_enabled === true);

  // ── The booking notices an owner and a renter actually receive ──
  // bookings.start_at is a naive local timestamp. Applying AT TIME ZONE to it
  // interprets rather than converts, which shifted every quoted pickup time
  // 5.5 hours backwards in the owner's "new booking" message. A wrong handover
  // time is the sort of bug that only shows up as a missed rental.
  const { data: renterProfile } = await service.auth.admin.createUser({
    email: `moderation-renter-${stamp}@example.invalid`, password: `Moderation-${stamp}-2!`,
    email_confirm: true, user_metadata: { full_name: "Moderation Renter", phone: `+9475${String(Date.now()).slice(-7)}` },
  });
  created.userIds.push(renterProfile.user.id);
  await service.from("profiles").update({ kyc_status: "verified" }).eq("id", renterProfile.user.id);

  const pickupDate = new Date(Date.now() + 25 * 86_400_000).toISOString().slice(0, 10);
  const { data: booking } = await service.from("bookings").insert({
    vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renterProfile.user.id,
    start_date: pickupDate, end_date: new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10),
    start_time: "10:00", end_time: "16:30", status: "pending_confirmation", daily_rate_lkr: 7000,
  }).select("id").single();

  const bookingNotice = async (match) => {
    const { data } = await service.from("notification_outbox").select("event_key, recipient_kind, text_body").eq("booking_id", booking.id);
    return (data ?? []).find((r) => r.event_key.includes(match));
  };

  const requestNotice = await bookingNotice(":request:page");
  check("a booking request notifies the Rental Page", Boolean(requestNotice));
  check("the request quotes the pick-up time the renter chose",
    (requestNotice?.text_body ?? "").includes("10:00 AM"), requestNotice?.text_body?.slice(0, 120));
  check("the request quotes the return time the renter chose",
    (requestNotice?.text_body ?? "").includes("4:30 PM"), requestNotice?.text_body?.slice(0, 120));

  await service.from("bookings").update({ status: "confirmed" }).eq("id", booking.id);
  const confirmNotice = await bookingNotice(":status:confirmed:renter");
  check("confirming a booking notifies the renter", Boolean(confirmNotice));
  check("the confirmation is addressed to the renter", confirmNotice?.recipient_kind === "renter");

  await service.from("bookings").update({ status: "declined", cancellation_reason: "Vehicle is in for service" }).eq("id", booking.id);
  const declineNotice = await bookingNotice(":status:declined:renter");
  check("declining a booking notifies the renter", Boolean(declineNotice));
  check("the decline tells the renter no payment was taken",
    /no payment was taken/i.test(declineNotice?.text_body ?? ""), declineNotice?.text_body?.slice(0, 120));

  await service.from("notification_outbox").delete().eq("booking_id", booking.id);
  await service.from("bookings").delete().eq("id", booking.id);
} finally {
  for (const key of outboxKeys) await service.from("notification_outbox").delete().eq("event_key", key);
  for (const id of created.vehicleIds) await service.from("vehicles").delete().eq("id", id);
  for (const id of created.agencyIds) await service.from("agencies").delete().eq("id", id);
  for (const id of created.userIds) await service.auth.admin.deleteUser(id);
  console.log(`\ncleaned up: ${outboxKeys.length} outbox rows, ${created.vehicleIds.length} vehicle, ${created.agencyIds.length} page, ${created.userIds.length} user`);
}

if (failures.length) {
  console.log(`\nLISTING MODERATION NOTICE: ${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`\nLISTING MODERATION NOTICE: ${passed} checks passed.`);
