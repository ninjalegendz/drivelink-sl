#!/usr/bin/env node

// Self-cleaning deployed check for a least-access fleet role. It verifies the
// invitation copy, explicit acceptance, RLS roster boundary, allowed fleet
// action, and denied booking action using real signed-in sessions.

import fs from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Staff-capability-verify-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = [];
let pageId = null;
let vehicleId = null;
let bookingId = null;
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function createTestUser(label) {
  const email = `staff-capability-${label}-${stamp}@example.invalid`;
  const phone = `+999${String(Date.now()).slice(-7)}${users.length}`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Staff ${label}`, phone } });
  if (error || !data.user) throw error ?? new Error("Could not create test account.");
  users.push(data.user.id);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const profile = await service.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (profile.data) break;
    if (attempt === 59) throw new Error("Temporary account did not receive a DriveLink profile.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const { error: updateError } = await service.from("profiles").update({
    email, email_verified_at: null, phone, kyc_status: "verified",
  }).eq("id", data.user.id);
  if (updateError) throw updateError;
  const { error: verifiedError } = await service.from("profiles").update({ phone_verified: true }).eq("id", data.user.id);
  if (verifiedError) throw verifiedError;

  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const signedIn = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Could not create a session.");
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await ssr.auth.setSession({ access_token: signedIn.data.session.access_token, refresh_token: signedIn.data.session.refresh_token });
  return { id: data.user.id, email, token: signedIn.data.session.access_token, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
}

async function request(path, cookie, body) {
  const response = await fetch(`${BASE}${path}`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function cleanup() {
  const failures = [];
  if (bookingId) {
    const { error } = await service.from("bookings").delete().eq("id", bookingId);
    if (error) failures.push(`booking: ${error.message}`);
  }
  if (vehicleId) {
    const { error } = await service.from("vehicles").delete().eq("id", vehicleId);
    if (error) failures.push(`vehicle: ${error.message}`);
  }
  if (pageId) {
    const { error } = await service.from("agencies").delete().eq("id", pageId);
    if (error) failures.push(`Rental Page: ${error.message}`);
  }
  if (users.length) {
    const { error } = await service.from("activity_events").delete().in("actor_id", users);
    if (error) failures.push(`activity audit: ${error.message}`);
  }
  for (const userId of users) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) failures.push(`test account ${userId.slice(0, 8)}: ${error.message}`);
  }
  if (failures.length) throw new Error(`Temporary fixture cleanup failed (${failures.join("; ")}).`);
}

try {
  const owner = await createTestUser("owner");
  const fleetStaff = await createTestUser("fleet");
  check("temporary owner and fleet staff accounts are ready", users.length === 2);

  const page = await request("/api/pages", owner.cookie, {
    name: `Staff role page ${stamp}`, page_type: "personal", city: "Colombo", whatsapp_number: "0774567890", email: `staff-page-${stamp}@example.invalid`,
  });
  check("owner creates a temporary Rental Page", page.status === 201 && Boolean(page.json.page?.id), JSON.stringify(page.json));
  pageId = page.json.page.id;
  await service.from("agencies").update({ sms_notifications_enabled: false, whatsapp_notifications_enabled: false, whatsapp_verified_at: new Date().toISOString() }).eq("id", pageId);

  const invite = await request(`/api/pages/${pageId}/members`, owner.cookie, { email: fleetStaff.email, role: "fleet_editor" });
  check("owner invites a fleet editor rather than an implicit manager", invite.status === 201 && invite.json.invitation?.role === "fleet_editor", JSON.stringify(invite.json));
  const invitationId = invite.json.invitation.id;

  const account = await fetch(`${BASE}/account`, { headers: { Cookie: fleetStaff.cookie } });
  const accountHtml = await account.text();
  check("invitee sees the exact role and its limits before accepting", account.status === 200 && accountHtml.includes("Fleet editor") && accountHtml.includes("Adds and updates vehicles"));

  const accepted = await request(`/api/account/team-invitations/${invitationId}`, fleetStaff.cookie, { action: "accept" });
  check("fleet staff must accept before receiving access", accepted.status === 200 && accepted.json.status === "accepted", JSON.stringify(accepted.json));

  const staffClient = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${fleetStaff.token}` } } });
  const roster = await staffClient.from("agency_members").select("user_id,role").eq("agency_id", pageId);
  check("fleet staff RLS reveals only their own membership", !roster.error && roster.data?.length === 1 && roster.data[0]?.user_id === fleetStaff.id && roster.data[0]?.role === "fleet_editor", JSON.stringify(roster));

  const { data: seedVehicle, error: seedError } = await service.from("vehicles")
    .select("make,model,year,insurance_type,daily_rate_lkr,deposit_lkr,city")
    .limit(1).maybeSingle();
  if (seedError || !seedVehicle) throw seedError ?? new Error("A vehicle seed is needed for this verification.");
  const insertedVehicle = await staffClient.from("vehicles").insert({
    agency_id: pageId, make: seedVehicle.make, model: seedVehicle.model, year: seedVehicle.year,
    insurance_type: seedVehicle.insurance_type, daily_rate_lkr: seedVehicle.daily_rate_lkr,
    deposit_lkr: seedVehicle.deposit_lkr ?? 0, city: "Colombo", status: "unlisted",
    slug: `staff-role-vehicle-${stamp}`, plate_number: `STF-${stamp}`,
    photos: Array(4).fill("/logo-horizontal.png"), self_drive: true, with_driver: false,
    listing_authority_basis: null, listing_authority_declared: false,
  }).select("id").single();
  if (insertedVehicle.error || !insertedVehicle.data) throw insertedVehicle.error ?? new Error("Could not create test vehicle.");
  vehicleId = insertedVehicle.data.id;
  check("fleet editor can save a complete private draft for owner review", Boolean(vehicleId));

  const forbiddenDeclaration = await staffClient.from("vehicles").update({
    listing_authority_basis: "registered_owner",
    listing_authority_declared: true,
  }).eq("id", vehicleId).select("id");
  const declarationAfter = await service.from("vehicles")
    .select("listing_authority_declared,listing_authority_confirmed_by")
    .eq("id", vehicleId).single();
  check(
    "fleet editor can prepare a listing but cannot make the owner's right-to-list declaration",
    Boolean(forbiddenDeclaration.error)
      && declarationAfter.data?.listing_authority_declared === false
      && !declarationAfter.data?.listing_authority_confirmed_by,
    JSON.stringify({ error: forbiddenDeclaration.error?.message, row: declarationAfter.data }),
  );

  const authority = await service.from("vehicles").update({
    listing_authority_basis: "registered_owner",
    listing_authority_declared: true,
    listing_authority_confirmed_at: new Date().toISOString(),
    listing_authority_confirmed_by: owner.id,
    listing_authority_declaration_version: "vehicle-authority-v1",
  }).eq("id", vehicleId);
  if (authority.error) throw authority.error;

  const fleetAction = await request(`/api/vehicles/${vehicleId}/status`, fleetStaff.cookie, { status: "available" });
  check("fleet editor can change a vehicle listing state", fleetAction.status === 200 && fleetAction.json.status === "available", JSON.stringify(fleetAction.json));

  const insertedBooking = await service.from("bookings").insert({
    vehicle_id: vehicleId, agency_id: pageId, renter_id: owner.id, status: "pending_confirmation",
    start_date: "2030-01-10", end_date: "2030-01-11", start_time: "10:00", end_time: "10:00",
    daily_rate_lkr: seedVehicle.daily_rate_lkr, subtotal_lkr: seedVehicle.daily_rate_lkr,
    deposit_lkr: seedVehicle.deposit_lkr ?? 0, rental_mode: "self_drive",
  }).select("id,status").single();
  if (insertedBooking.error || !insertedBooking.data) throw insertedBooking.error ?? new Error("Could not create test booking.");
  bookingId = insertedBooking.data.id;

  const deniedBooking = await request("/api/bookings/transition", fleetStaff.cookie, { bookingId, to: "declined" });
  const bookingAfter = await service.from("bookings").select("status").eq("id", bookingId).single();
  check("fleet editor cannot accept or decline rental requests", deniedBooking.status === 403 && bookingAfter.data?.status === "pending_confirmation", JSON.stringify(deniedBooking.json));

  console.log(`\n${passed} deployed staff-capability checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("cleanup", error instanceof Error ? error.message : error));
}
