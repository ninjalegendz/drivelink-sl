#!/usr/bin/env node

// Thin, self-cleaning production-route check for the self-drive gate. It
// creates isolated test accounts with no deliverable phone/email, invokes the
// deployed HTTP endpoints using real SSR cookies, then removes every fixture.

import fs from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Self-drive-verify-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const created = { users: [], agencyId: null, vehicleId: null, bookingIds: [] };
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function createUser(label) {
  const email = `self-drive-${label}-${stamp}@phone.drivelink.invalid`;
  const phone = `+947${String(Date.now() + created.users.length).slice(-8)}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Self-drive ${label}`, phone },
  });
  if (error || !data.user) throw error ?? new Error("No test user was created.");
  created.users.push(data.user.id);
  return { id: data.user.id, email };
}

async function sessionHeader(email) {
  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("No session created.");
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(cookie, method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function waitForProfiles(ids) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await service.from("profiles").select("id").in("id", ids);
    if (error) throw error;
    if ((data ?? []).length === ids.length) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for test profiles.");
}

async function updateProfile(id, values) {
  const { data, error } = await service.from("profiles").update(values).eq("id", id).select("id, kyc_status, license_review_status, license_jurisdiction").single();
  if (error || !data) throw error ?? new Error(`Profile ${id} was not updated.`);
  return data;
}

async function cleanup() {
  if (created.bookingIds.length) await service.from("bookings").delete().in("id", created.bookingIds);
  if (created.vehicleId) await service.from("vehicles").delete().eq("id", created.vehicleId);
  if (created.agencyId) await service.from("agencies").delete().eq("id", created.agencyId);
  for (const userId of created.users) await service.auth.admin.deleteUser(userId);
}

try {
  const renter = await createUser("renter");
  const owner = await createUser("owner");
  const admin = await createUser("admin");
  await waitForProfiles([renter.id, owner.id, admin.id]);
  // Blank-but-non-null values keep the schema's legacy NOT NULL constraint
  // satisfied while the notification outbox treats them as no phone number.
  // Use unique whitespace lengths because old test accounts can be retained
  // by auth recovery rules and `phone` remains unique while active.
  const blankLength = (Date.now() % 1000) + 10;
  await updateProfile(renter.id, { phone: " ".repeat(blankLength), kyc_status: "verified" });
  await updateProfile(owner.id, { phone: " ".repeat(blankLength + 1), kyc_status: "verified" });
  await updateProfile(admin.id, { phone: " ".repeat(blankLength + 2), role: "admin" });

  const { data: agency, error: agencyError } = await service.from("agencies").insert({
    owner_id: owner.id, name: `Self-drive Route Test ${stamp}`, city: "Colombo", whatsapp_number: "+94700000001", whatsapp_verified_at: new Date().toISOString(), page_type: "personal", is_verified: true,
  }).select("id").single();
  if (agencyError || !agency) throw agencyError ?? new Error("No test Rental Page.");
  created.agencyId = agency.id;

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: "Route Check", year: 2022, insurance_type: "hire", fuel_policy: "full_to_full",
    daily_rate_lkr: 10000, deposit_lkr: 0, seats: 5, transmission: "automatic", status: "available", city: "Colombo",
    slug: `self-drive-route-${stamp}`, plate_number: `SDR-${stamp}`, photos: Array(4).fill("/logo-horizontal.png"), self_drive: true, with_driver: false,
    listing_authority_basis: "registered_owner", listing_authority_declared: true, listing_authority_confirmed_at: new Date().toISOString(), listing_authority_confirmed_by: owner.id, listing_authority_declaration_version: "vehicle-authority-v1",
    vehicle_type: "car", fuel_type: "petrol", min_renter_age: 23, min_license_years: 2,
  }).select("id").single();
  if (vehicleError || !vehicle) throw vehicleError ?? new Error("No test vehicle.");
  created.vehicleId = vehicle.id;

  const pickup = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const returnDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const draft = { vehicle_id: vehicle.id, start_date: pickup, end_date: returnDate, start_time: "10:00", end_time: "10:00", rental_mode: "self_drive" };
  const [renterCookie, adminCookie] = await Promise.all([sessionHeader(renter.email), sessionHeader(admin.email)]);

  const submittedProfile = await updateProfile(renter.id, {
    license_front_url: `/api/docs/kyc/${renter.id}/front.jpg`, license_back_url: `/api/docs/kyc/${renter.id}/back.jpg`,
    date_of_birth: "1990-06-15", license_issued_on: "2015-06-15", license_expires_on: "2030-06-15",
    license_jurisdiction: "sri_lanka", license_review_status: "pending", license_reviewed_at: null,
  });
  check("test renter is identity-verified before self-drive checks", submittedProfile.kyc_status === "verified", JSON.stringify(submittedProfile));
  const pending = await request(renterCookie, "POST", "/api/bookings", draft);
  check("deployed route blocks an unreviewed licence", pending.status === 403 && pending.json.needsLicenceReview === true, JSON.stringify(pending.json));

  const approved = await request(adminCookie, "PATCH", `/api/admin/users/${renter.id}/license`, { status: "verified" });
  check("admin can approve a complete pending licence through the deployed route", approved.status === 200, JSON.stringify(approved.json));
  const status = await request(renterCookie, "GET", "/api/account/license/status");
  check("renter sees reviewed licence status without document URLs", status.status === 200 && status.json.reviewStatus === "verified" && !Object.hasOwn(status.json, "frontUrl"), JSON.stringify(status.json));

  await updateProfile(renter.id, { license_issued_on: "1980-06-15" });
  const impossibleDates = await request(renterCookie, "POST", "/api/bookings", draft);
  check("deployed route refuses impossible licence dates", impossibleDates.status === 403 && impossibleDates.json.eligibilityCode === "licence_review_required", JSON.stringify(impossibleDates.json));

  await updateProfile(renter.id, { date_of_birth: "2005-10-01", license_issued_on: "2015-06-15" });
  const underAge = await request(renterCookie, "POST", "/api/bookings", draft);
  check("deployed route enforces the listing's minimum driver age", underAge.status === 403 && underAge.json.eligibilityCode === "minimum_age", JSON.stringify(underAge.json));

  await updateProfile(renter.id, { date_of_birth: "1990-06-15", license_issued_on: "2025-10-01" });
  const inexperienced = await request(renterCookie, "POST", "/api/bookings", draft);
  check("deployed route enforces the listing's minimum licence experience", inexperienced.status === 403 && inexperienced.json.eligibilityCode === "minimum_experience", JSON.stringify(inexperienced.json));

  await updateProfile(renter.id, { license_issued_on: "2015-06-15", license_jurisdiction: "foreign" });
  const missingPermit = await request(renterCookie, "POST", "/api/bookings", draft);
  check("deployed route blocks a foreign licence without a declared permit", missingPermit.status === 403 && missingPermit.json.eligibilityCode === "foreign_permit_required", JSON.stringify(missingPermit.json));

  await updateProfile(renter.id, { license_jurisdiction: "sri_lanka" });
  const accepted = await request(renterCookie, "POST", "/api/bookings", draft);
  check("deployed route accepts an eligible reviewed driver", accepted.status === 201 && !!accepted.json.bookingId, JSON.stringify(accepted.json));
  created.bookingIds.push(accepted.json.bookingId);
  const { data: saved } = await service.from("bookings").select("driver_age_at_pickup, driver_license_years_at_pickup, driver_license_jurisdiction, driver_license_reviewed_at").eq("id", accepted.json.bookingId).single();
  check("accepted booking keeps an eligibility snapshot without DOB", saved?.driver_age_at_pickup === 36 && saved?.driver_license_years_at_pickup === 11 && saved?.driver_license_jurisdiction === "sri_lanka" && !!saved?.driver_license_reviewed_at, JSON.stringify(saved));

  console.log(`\n${passed} deployed self-drive route checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("cleanup", error instanceof Error ? error.message : error));
}
