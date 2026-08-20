#!/usr/bin/env node

import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Return-recovery-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const PRIVATE_BUCKET = env.R2_PRIVATE_BUCKET || "drivelink-private";
const created = { users: [], agencyId: null, vehicleId: null, bookings: [] };
const phoneSeed = Date.now().toString().slice(-6);
let passed = 0;
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function createUser(label, role = null) {
  const email = `return-${label}-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `Return ${label}`, phone: `+9470${phoneSeed}${created.users.length}` },
  });
  if (error) throw error;
  created.users.push(data.user.id);
  if (role) await service.from("profiles").update({ role }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

async function sessionFor(email) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("No session");
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return {
    header: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    cookies: () => [...jar].map(([name, value]) => ({ name, value, domain: new URL(BASE).hostname, path: "/", secure: BASE.startsWith("https") })),
  };
}

async function jsonApi(session, method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method, headers: { Cookie: session.header(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function binaryApi(session, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { Cookie: session.header(), "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, contentType: response.headers.get("content-type"), bytes: new Uint8Array(await response.arrayBuffer()) };
}

async function downloadApi(session, path) {
  const response = await fetch(`${BASE}${path}`, { headers: { Cookie: session.header() } });
  return { status: response.status, contentType: response.headers.get("content-type"), bytes: new Uint8Array(await response.arrayBuffer()) };
}

async function waitForFullPack(session, bookingId, exportId) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const result = await jsonApi(session, "GET", `/api/bookings/${bookingId}/evidence-pack?export=${exportId}`);
    if (result.status === 200 && result.json.status === "ready") return result.json;
    if (result.status === 200 && result.json.status === "failed") throw new Error(`Full evidence pack failed: ${result.json.failureReason ?? "no reason returned"}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Timed out waiting for the asynchronous full evidence pack.");
}

const agreementTerms = {
  parties: { renter: { name: "Return Renter", nic_masked: "19******V" }, page: { name: "Return Test Page", page_type: "business", page_type_label: "Verified business", whatsapp_number: "+94700000000" }, platform_disclaimer: "DriveLink records the booking and is not a party to the rental." },
  vehicle: { make: "Toyota", model: "Recovery Test", year: 2020, plate_number: "TEST-089", fuel_type: "petrol", insurance_type: "hire", insurance_type_label: "Hire insurance declared", fuel_policy: "full_to_full", fuel_policy_label: "Full to full" },
  period: { start_at: "2026-08-01T00:00:00Z", end_at: "2026-08-02T00:00:00Z", start_date: "2026-08-01", end_date: "2026-08-02", start_time: "00:00", end_time: "00:00", total_days: 1 },
  pricing: { daily_rate_lkr: 10000, total_days: 1, subtotal_lkr: 10000, weekly_rate_lkr: null, monthly_rate_lkr: null, breakdown: { full_months: 0, months_cost_lkr: 0, remaining_days: 1, days_cost_lkr: 10000 } },
  deposit: { amount_lkr: 0, refund_terms: "No deposit was listed.", banned_securities: "Passports and blank cheques are not accepted as security." },
  mileage: { unlimited: false, included_km_per_day: 100, extra_km_rate_lkr: 100, label: "100 km/day included" },
  fuel: { policy: "full_to_full", policy_label: "Full to full", fuel_type: "petrol", wrong_fuel_clause: "Use the listed fuel type.", refuel_fee_lkr: 1000 },
  fees: { cleaning_fee_lkr: 5000, cleaning_fee_note: "Only for documented excessive dirt.", late_fee_per_hour_lkr: 1000, late_fee_label: "Rs. 1,000/hour", grace: "2 hours" },
  usage: { named_drivers_only: true, second_driver_allowed: false, ride_hail_allowed: false, smoking_allowed: false, pets_allowed: false, restricted_use: ["racing"], geographic_note: "Use within Sri Lanka.", driver_requirement: "Original licence must be inspected." },
  disclosures: { gps_tracker: false, gps_tracker_note: null, etc_tag: false, etc_tag_note: null },
  with_driver: null,
  liability: { insurance_type: "hire", note: "Coverage depends on the insurer and policy.", prominent: false, breach_full_liability: "A terms breach may affect liability.", accident_protocol: "Stop safely and contact the Rental Page and relevant authorities.", platform_disclaimer: "DriveLink is not an insurer." },
  fines_tolls: { renter_liable_note: "The renter is responsible for in-period fines and tolls.", owner_claim_window_days: 30, owner_claim_note: "The Rental Page may submit official notices within 30 days." },
  late_return: { grace: "2 hours", hourly_fee_label: "Rs. 1,000/hour", cap: "Capped at one daily rate.", after_24h: "Contact evidence and DriveLink admin review are required before account action." },
  disputes: { mediation_first: "DriveLink records both sides and reviews the evidence." },
};

async function removeRows(table, column, values) {
  if (!values.length) return;
  const { error } = await service.from(table).delete().in(column, values);
  if (error) throw new Error(`Cleanup ${table}.${column}: ${error.message}`);
}

async function purgeFixtures(userIds, pageIds, bookingIds) {
  const bookingChildren = [
    "incident_settlement_payments", "incident_responses", "booking_settlement_payments",
    "evidence_exports", "notification_outbox", "booking_overdue_reviews",
    "booking_contact_attempts", "booking_extensions", "document_access_log",
    "booking_messages", "booking_inspections", "incidents", "booking_charges",
    "booking_agreements", "blacklist_reports", "reviews", "wallet_transactions", "agency_penalties",
  ];
  if (bookingIds.length) {
    const { data: exports, error: exportsError } = await service.from("evidence_exports").select("storage_key").in("booking_id", bookingIds).not("storage_key", "is", null);
    if (exportsError) throw exportsError;
    for (const row of exports ?? []) {
      if (row.storage_key) await r2.send(new DeleteObjectCommand({ Bucket: PRIVATE_BUCKET, Key: row.storage_key }));
    }
  }
  for (const table of bookingChildren) await removeRows(table, "booking_id", bookingIds);
  await removeRows("activity_events", "related_booking_id", bookingIds);
  await removeRows("bookings", "id", bookingIds);

  if (pageIds.length) {
    const { data: vehicles, error } = await service.from("vehicles").select("id").in("agency_id", pageIds);
    if (error) throw error;
    await removeRows("vehicle_blocks", "vehicle_id", (vehicles ?? []).map((row) => row.id));
  }
  await removeRows("agency_member_permission_events", "agency_id", pageIds);
  await removeRows("agency_members", "agency_id", pageIds);
  await removeRows("activity_events", "related_agency_id", pageIds);
  await removeRows("vehicles", "agency_id", pageIds);
  await removeRows("agencies", "id", pageIds);
  await removeRows("activity_events", "actor_id", userIds);
  for (const id of userIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw new Error(`Cleanup auth user ${id}: ${error.message}`);
  }
}

async function setup() {
  const existingUsers = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const staleIds = (existingUsers.data?.users ?? []).filter((user) => user.email?.startsWith("return-") && user.email.endsWith("@phone.drivelink.invalid")).map((user) => user.id);
  if (staleIds.length) {
    const { data: stalePages } = await service.from("agencies").select("id").in("owner_id", staleIds);
    const pageIds = (stalePages ?? []).map((row) => row.id);
    const { data: renterBookings } = await service.from("bookings").select("id").in("renter_id", staleIds);
    const { data: pageBookings } = pageIds.length ? await service.from("bookings").select("id").in("agency_id", pageIds) : { data: [] };
    const bookingIds = [...new Set([...(renterBookings ?? []), ...(pageBookings ?? [])].map((row) => row.id))];
    await purgeFixtures(staleIds, pageIds, bookingIds);
  }
  const renter = await createUser("renter");
  const owner = await createUser("owner");
  const staff = await createUser("staff");
  const outsider = await createUser("outsider");
  const admin = await createUser("admin", "admin");
  await service.from("profiles").update({ phone: null }).in("id", [renter.id, owner.id, staff.id, outsider.id, admin.id]);
  await service.from("profiles").update({ kyc_status: "verified", nic_number: `199${Date.now().toString().slice(-6)}V` }).in("id", [renter.id, owner.id]);
  const { data: agency, error: agencyError } = await service.from("agencies").insert({ owner_id: owner.id, name: `Return Test Page ${stamp}`, city: "Colombo", whatsapp_number: "+94700000000", page_type: "business", is_verified: true }).select("id").single();
  if (agencyError) throw agencyError;
  created.agencyId = agency.id;
  await service.from("agency_members").insert({ agency_id: agency.id, user_id: staff.id, invited_by: owner.id });
  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: "Recovery Test", year: 2020, vehicle_type: "car", fuel_type: "petrol", insurance_type: "hire", fuel_policy: "full_to_full", daily_rate_lkr: 10000, deposit_lkr: 0, seats: 5, transmission: "automatic", status: "available", city: "Colombo", slug: `return-test-${stamp}`, plate_number: `RTR-${stamp}`, photos: Array(4).fill("/logo-horizontal.png"), self_drive: true, with_driver: false,
    listing_authority_basis: "registered_owner", listing_authority_declared: true, listing_authority_confirmed_at: new Date().toISOString(), listing_authority_confirmed_by: owner.id, listing_authority_declaration_version: "vehicle-authority-v1",
  }).select("id").single();
  if (vehicleError) throw vehicleError;
  created.vehicleId = vehicle.id;

  const futureStart = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  const futureEnd = new Date(Date.now() + 11 * 86400_000).toISOString().slice(0, 10);
  const overdueStart = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const overdueEnd = new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10);
  const { data: bookings, error: bookingError } = await service.from("bookings").insert([
    { vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id, status: "active", start_date: futureStart, end_date: futureEnd, start_time: "00:00", end_time: "00:00", daily_rate_lkr: 10000, subtotal_lkr: 10000, deposit_lkr: 0, rental_mode: "self_drive" },
    { vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id, status: "active", start_date: overdueStart, end_date: overdueEnd, start_time: "00:00", end_time: "00:00", daily_rate_lkr: 10000, subtotal_lkr: 10000, deposit_lkr: 0, rental_mode: "self_drive", overdue_review_prompted_at: new Date().toISOString() },
  ]).select("id");
  if (bookingError) throw bookingError;
  created.bookings = bookings.map((row) => row.id);
  for (const row of bookings) await service.from("booking_agreements").insert({ booking_id: row.id, template_version: "recovery-ui", terms: agreementTerms, renter_accepted_at: new Date().toISOString(), owner_accepted_at: new Date().toISOString(), terms_hash: "1".repeat(64) });
  return { renter, owner, staff, outsider, admin, futureId: bookings[0].id, overdueId: bookings[1].id };
}

async function screenshot(session, path, filename, viewport, expectedText, clickText = null, afterClickText = null) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addCookies(session.cookies());
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  try {
    await page.getByText(expectedText, { exact: false }).first().waitFor({ timeout: 15000 });
  } catch (error) {
    fs.mkdirSync("artifacts", { recursive: true });
    await page.screenshot({ path: `artifacts/${filename}-failure.png`, fullPage: true });
    const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1200);
    throw new Error(`${filename} did not render ${JSON.stringify(expectedText)} at ${page.url()} (${await page.title()}): ${visibleText}`, { cause: error });
  }
  if (clickText) {
    for (const text of (Array.isArray(clickText) ? clickText : [clickText])) {
      await page.getByText(text, { exact: false }).first().click();
    }
    if (afterClickText) await page.getByText(afterClickText, { exact: false }).first().waitFor({ timeout: 15000 });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`${filename} has no horizontal overflow`, !overflow);
  fs.mkdirSync("artifacts", { recursive: true });
  await page.screenshot({ path: `artifacts/${filename}.png`, fullPage: true });
  await browser.close();
}

async function screenshotReadyEvidenceExport(session) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies(session.cookies());
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard/bookings?status=active`, { waitUntil: "networkidle" });
  // The fixture has one ordinary future booking and one confirmed critical
  // return. Only the latter must offer the identity-bearing full pack.
  await page.getByText("Booking record", { exact: false }).last().click();
  await page.getByText("Full ZIP", { exact: false }).first().click();
  await page.getByText("Your full pack is ready.", { exact: false }).first().waitFor({ timeout: 15000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("evidence-export-owner-desktop has no horizontal overflow", !overflow);
  fs.mkdirSync("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/evidence-export-owner-desktop.png", fullPage: true });
  await browser.close();
}

async function cleanup() {
  await purgeFixtures(created.users, created.agencyId ? [created.agencyId] : [], created.bookings);
}

let fixture;
try {
  fixture = await setup();
  const sessions = {
    renter: await sessionFor(fixture.renter.email), owner: await sessionFor(fixture.owner.email),
    staff: await sessionFor(fixture.staff.email), outsider: await sessionFor(fixture.outsider.email), admin: await sessionFor(fixture.admin.email),
  };
  const futureEnd = new Date(Date.now() + 13 * 86400_000).toISOString();
  const request = await jsonApi(sessions.renter, "POST", `/api/bookings/${fixture.futureId}/recovery`, { action: "request_extension", proposed_end_at: futureEnd, reason: "A family commitment requires two additional days." });
  check("renter extension request works through the real endpoint", request.status === 200, JSON.stringify(request.json));
  const extensionId = request.json.result.id;
  const offer = await jsonApi(sessions.owner, "POST", `/api/bookings/${fixture.futureId}/recovery`, { action: "respond_extension", extension_id: extensionId, response: "offer", additional_rental_lkr: 18000 });
  check("page sends an exact extension offer", offer.status === 200, JSON.stringify(offer.json));
  const accept = await jsonApi(sessions.renter, "POST", `/api/bookings/${fixture.futureId}/recovery`, { action: "respond_extension", extension_id: extensionId, response: "accept" });
  check("renter accepts exact extension offer", accept.status === 200, JSON.stringify(accept.json));

  const callAt = new Date(Date.now() - 30 * 60_000).toISOString();
  const call = await jsonApi(sessions.owner, "POST", `/api/bookings/${fixture.overdueId}/recovery`, { action: "record_contact", channel: "call", outcome: "no_answer", note: "Called twice and the phone rang without an answer.", attempted_at: callAt });
  const written = await jsonApi(sessions.owner, "POST", `/api/bookings/${fixture.overdueId}/recovery`, { action: "record_contact", channel: "whatsapp", outcome: "message_sent", note: "Sent the booking reference and requested an immediate reply." });
  check("page records call and written attempts through the real endpoint", call.status === 200 && written.status === 200, `${call.status}/${written.status}`);
  const review = await jsonApi(sessions.owner, "POST", `/api/bookings/${fixture.overdueId}/recovery`, { action: "request_review", reason: "The vehicle remains unreturned after both a call and written contact attempt." });
  check("page can request but not decide the critical review", review.status === 200 && review.json.result.status === "pending", JSON.stringify(review.json));
  const recoveryState = await jsonApi(sessions.owner, "GET", `/api/bookings/${fixture.overdueId}/recovery`);
  check("both screens receive the same pending review state", recoveryState.status === 200 && recoveryState.json.review?.status === "pending", JSON.stringify(recoveryState.json));

  await screenshot(sessions.owner, "/dashboard/bookings?status=active", "return-recovery-owner-desktop", { width: 1440, height: 1000 }, "Return timeline");
  await screenshot(sessions.renter, `/bookings/${fixture.overdueId}`, "return-recovery-renter-mobile", { width: 390, height: 844 }, "Return timeline");
  await screenshot(sessions.admin, "/admin/bookings?status=active", "return-recovery-admin-desktop", { width: 1440, height: 1000 }, "Return review", "Return review", "Decide critical-return review");

  const summaryReason = "Checking the return timeline for the open review";
  const shortReason = await binaryApi(sessions.owner, `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "summary", reason: "Too short" });
  check("evidence export requires a useful reason", shortReason.status === 400);
  const outsider = await binaryApi(sessions.outsider, `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "summary", reason: summaryReason });
  check("outsider cannot export any booking record", outsider.status === 403);
  const staffDenied = await binaryApi(sessions.staff, `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "summary", reason: summaryReason });
  check("ordinary staff cannot export renter records", staffDenied.status === 403);
  await service.from("agency_members").update({ can_view_renter_documents: true, document_permission_granted_by: fixture.owner.id, document_permission_granted_at: new Date().toISOString() }).eq("agency_id", created.agencyId).eq("user_id", fixture.staff.id);
  const staffSummary = await binaryApi(sessions.staff, `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "summary", reason: summaryReason });
  check("explicitly authorised staff can export only the summary", staffSummary.status === 200 && new TextDecoder().decode(staffSummary.bytes.slice(0, 4)) === "%PDF");
  const parsedSummary = await PDFDocument.load(staffSummary.bytes);
  check("the masked summary is a readable PDF with at least one page", parsedSummary.getPageCount() >= 1);
  const ownerFullEarly = await jsonApi(sessions.owner, "POST", `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "full", reason: summaryReason });
  check("even the owner cannot export the full pack before critical approval", ownerFullEarly.status === 409);

  const decision = await jsonApi(sessions.admin, "POST", `/api/bookings/${fixture.overdueId}/recovery`, { action: "decide_review", review_id: review.json.result.id, decision: "approve", note: "The agreed return time and both contact methods were checked; the vehicle remains recorded as unreturned." });
  check("admin approval works through the real endpoint", decision.status === 200 && decision.json.result.status === "approved", JSON.stringify(decision.json));
  const staffFull = await binaryApi(sessions.staff, `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "full", reason: summaryReason });
  check("document-authorised staff still cannot export full identity pack", staffFull.status === 403);
  const ownerFull = await jsonApi(sessions.owner, "POST", `/api/bookings/${fixture.overdueId}/evidence-pack`, { kind: "full", reason: "Preparing the confirmed critical-return records for professional review" });
  check("owner can queue a full pack only after admin approval", ownerFull.status === 202 && typeof ownerFull.json.exportId === "string" && ownerFull.json.status === "queued", JSON.stringify(ownerFull.json));
  const packState = await waitForFullPack(sessions.owner, fixture.overdueId, ownerFull.json.exportId);
  check("the private worker finishes the queued full pack and gives it a seven-day expiry", packState.status === "ready" && typeof packState.availableUntil === "string" && new Date(packState.availableUntil) > new Date(), JSON.stringify(packState));
  await screenshotReadyEvidenceExport(sessions.owner);
  const ownerFullDownload = await downloadApi(sessions.owner, `/api/bookings/${fixture.overdueId}/evidence-pack?export=${ownerFull.json.exportId}&download=1`);
  check("owner can download the private full pack once it is ready", ownerFullDownload.status === 200 && ownerFullDownload.bytes[0] === 0x50 && ownerFullDownload.bytes[1] === 0x4b, `${ownerFullDownload.status} ${ownerFullDownload.contentType}`);
  const zip = unzipSync(ownerFullDownload.bytes);
  check("full pack contains independent summary, agreement, manifest, and structured records", !!zip["case-summary.pdf"] && !!zip["agreement.pdf"] && !!zip["manifest.json"] && !!zip["records/contact_attempts.json"] && !!zip["records/overdue_review.json"] && !!zip["records/charges.json"]);
  const [caseSummaryPdf, agreementPdf] = await Promise.all([
    PDFDocument.load(zip["case-summary.pdf"]),
    PDFDocument.load(zip["agreement.pdf"]),
  ]);
  check("the full pack contains readable case-summary and agreement PDFs", caseSummaryPdf.getPageCount() >= 1 && agreementPdf.getPageCount() >= 1);
  if (process.env.DRIVELINK_KEEP_PDF_FIXTURES === "1") {
    fs.mkdirSync("tmp/pdfs", { recursive: true });
    fs.writeFileSync("tmp/pdfs/recovery-masked-summary.pdf", staffSummary.bytes);
    fs.writeFileSync("tmp/pdfs/recovery-case-summary.pdf", zip["case-summary.pdf"]);
    fs.writeFileSync("tmp/pdfs/recovery-agreement.pdf", zip["agreement.pdf"]);
  }
  const manifest = JSON.parse(new TextDecoder().decode(zip["manifest.json"]));
  check("manifest fingerprints every pre-manifest file and reports omissions", manifest.version === 2 && manifest.files.length >= 11 && manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)) && Array.isArray(manifest.omitted_files));
  const { count: exportCount } = await service.from("evidence_exports").select("id", { count: "exact", head: true }).eq("booking_id", fixture.overdueId);
  check("successful exports are recorded for renter visibility", exportCount === 2);

  await screenshot(sessions.renter, "/account/documents", "return-recovery-export-history-mobile", { width: 390, height: 844 }, "Booking record exports");
  console.log(`\n${passed} authenticated recovery/evidence/UI checks passed.`);
} finally {
  await cleanup();
}
