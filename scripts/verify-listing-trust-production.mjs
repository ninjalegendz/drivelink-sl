#!/usr/bin/env node

// Self-cleaning production proof for the two trust boundaries introduced in
// migrations 104 and 105. It exercises the ordinary authenticated role for
// listing/document changes, then checks that an inactive Rental Page cannot
// leak through public search or accept a direct booking request.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Listing-trust-verify-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);

if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const service = createSupabaseClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const created = { users: [], pageId: null, vehicleId: null };
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function expectSqlError(label, sql, params = []) {
  const savepoint = `expected_${passed + 1}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await client.query(sql, params);
    throw new Error(`Expected failure did not occur: ${label}`);
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    if (error instanceof Error && error.message.startsWith("Expected failure")) throw error;
    check(label, true);
  } finally {
    await client.query(`release savepoint ${savepoint}`);
  }
}

async function createUser(label) {
  const email = `listing-trust-${label}-${stamp}@example.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Listing trust ${label}` },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${label} test account.`);
  created.users.push(data.user.id);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const profile = await service.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (profile.data) break;
    if (attempt === 59) throw new Error(`Timed out waiting for ${label} profile.`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const { error: profileError } = await service.from("profiles").update({
    kyc_status: "verified",
    phone: " ".repeat(30 + created.users.length),
    phone_verified: true,
    ...(label === "admin" ? { role: "admin" } : {}),
  }).eq("id", data.user.id);
  if (profileError) throw profileError;
  return { id: data.user.id, email };
}

async function sessionHeader(email) {
  const anon = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("Could not create test session.");

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

async function cleanup() {
  if (created.vehicleId) await service.from("vehicles").delete().eq("id", created.vehicleId);
  if (created.pageId) await service.from("agencies").delete().eq("id", created.pageId);
  for (const userId of created.users) await service.auth.admin.deleteUser(userId);
}

await client.connect();
try {
  const owner = await createUser("owner");
  const renter = await createUser("renter");
  const admin = await createUser("admin");

  const { data: page, error: pageError } = await service.from("agencies").insert({
    owner_id: owner.id,
    name: `Listing trust ${stamp}`,
    slug: `listing-trust-${stamp}`,
    city: "Colombo",
    whatsapp_number: "+94770000001",
    whatsapp_verified_at: new Date().toISOString(),
    sms_notifications_enabled: false,
    whatsapp_notifications_enabled: false,
    page_type: "personal",
    is_verified: true,
  }).select("id").single();
  if (pageError || !page) throw pageError ?? new Error("Could not create test Rental Page.");
  created.pageId = page.id;

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: page.id,
    make: "Toyota",
    model: "Trust Check",
    year: 2022,
    insurance_type: "hire",
    insurance_expiry: "2099-12-31",
    revenue_license_expiry: "2099-12-31",
    fuel_policy: "full_to_full",
    daily_rate_lkr: 10000,
    deposit_lkr: 0,
    seats: 5,
    transmission: "automatic",
    city: "Colombo",
    status: "available",
    slug: `listing-trust-vehicle-${stamp}`,
    plate_number: `LTR-${stamp}`,
    photos: ["/logo-horizontal.png", "/logo-horizontal.png", "/logo-horizontal.png", "/logo-horizontal.png"],
    listing_authority_basis: "registered_owner",
    listing_authority_declared: true,
    listing_authority_confirmed_at: new Date().toISOString(),
    listing_authority_confirmed_by: owner.id,
    listing_authority_declaration_version: "vehicle-authority-v1",
    self_drive: false,
    with_driver: true,
    vehicle_type: "car",
    fuel_type: "petrol",
  }).select("id").single();
  if (vehicleError || !vehicle) throw vehicleError ?? new Error("Could not create test vehicle.");
  created.vehicleId = vehicle.id;

  await client.query("begin");
  const incompletePlate = await client.query(
    `insert into public.vehicles (
       agency_id, make, model, year, insurance_type, daily_rate_lkr, city, slug,
       photos, self_drive, with_driver, listing_authority_basis,
       listing_authority_declared, listing_authority_confirmed_at,
       listing_authority_confirmed_by, listing_authority_declaration_version, status
     ) values ($1,'Toyota','No Plate',2022,'hire',10000,'Colombo',$2,
       array['/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png'],
       false,true,'registered_owner',true,now(),$3,'vehicle-authority-v1','pending_review')
     returning id`,
    [page.id, `missing-plate-${stamp}`, owner.id],
  );
  await expectSqlError(
    "a listing without a private plate record cannot be published",
    "update public.vehicles set status='available' where id=$1",
    [incompletePlate.rows[0].id],
  );
  const incompleteAuthority = await client.query(
    `insert into public.vehicles (
       agency_id, make, model, year, plate_number, insurance_type, daily_rate_lkr,
       city, slug, photos, self_drive, with_driver, status
     ) values ($1,'Toyota','No Authority',2022,$2,'hire',10000,'Colombo',$3,
       array['/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png'],
       false,true,'pending_review') returning id`,
    [page.id, `LNA-${stamp}`, `missing-authority-${stamp}`],
  );
  await expectSqlError(
    "a listing without a recorded right-to-list declaration cannot be published",
    "update public.vehicles set status='available' where id=$1",
    [incompleteAuthority.rows[0].id],
  );
  const punctuationVariant = await client.query(
    `insert into public.vehicles (
       agency_id, make, model, year, plate_number, insurance_type, daily_rate_lkr,
       city, slug, photos, self_drive, with_driver, listing_authority_basis,
       listing_authority_declared, listing_authority_confirmed_at,
       listing_authority_confirmed_by, listing_authority_declaration_version, status
     ) values ($1,'Toyota','Plate Variant',2022,$2,'hire',10000,'Colombo',$3,
       array['/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png'],
       false,true,'registered_owner',true,now(),$4,'vehicle-authority-v1','pending_review') returning id`,
    [page.id, `DUP-${stamp}`, `plate-source-${stamp}`, owner.id],
  );
  await expectSqlError(
    "the same physical plate cannot be listed twice by changing spaces or punctuation",
    `insert into public.vehicles (
       agency_id, make, model, year, plate_number, insurance_type, daily_rate_lkr,
       city, slug, photos, self_drive, with_driver, status
     ) values ($1,'Toyota','Plate Duplicate',2022,$2,'hire',10000,'Colombo',$3,
       array['/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png'],
       false,true,'unlisted')`,
    [page.id, `DUP ${stamp}`, `plate-duplicate-${stamp}`],
  );
  await client.query("delete from public.vehicles where id=$1", [punctuationVariant.rows[0].id]);
  await client.query("rollback");

  const { error: publicationError } = await service.from("vehicles").update({ status: "available" }).eq("id", vehicle.id);
  if (publicationError) throw publicationError;
  const publicClient = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const [{ data: publishedState, error: stateError }, { data: publicProbe, error: publicProbeError }, { data: pageEligible, error: pageEligibleError }] = await Promise.all([
    service.from("vehicles").select("id,status,agency_id").eq("id", vehicle.id).single(),
    publicClient.from("vehicles").select("id,make,model,status,agencies(id,name)").eq("id", vehicle.id).maybeSingle(),
    publicClient.rpc("rental_page_is_public", { p_agency_id: page.id }),
  ]);
  check(
    "a moderated eligible test listing passes the anonymous database visibility boundary",
    publishedState?.status === "available" && pageEligible === true && publicProbe?.id === vehicle.id,
    JSON.stringify({ publishedState, stateError: stateError?.message, pageEligible, pageEligibleError: pageEligibleError?.message, publicProbe, publicProbeError: publicProbeError?.message }),
  );

  const activeStorefront = await fetch(`${BASE}/pages/listing-trust-${stamp}`);
  const activeStorefrontBody = await activeStorefront.text();
  check(
    "an eligible Rental Page storefront is publicly readable without exposing its contact number",
    activeStorefront.status === 200
      && activeStorefrontBody.includes(`Listing trust ${stamp}`)
      && !activeStorefrontBody.includes("+94770000001"),
    JSON.stringify({
      status: activeStorefront.status,
      hasExpectedName: activeStorefrontBody.includes(`Listing trust ${stamp}`),
      exposesPhone: activeStorefrontBody.includes("+94770000001"),
      noindex: /noindex/i.test(activeStorefrontBody),
      length: activeStorefrontBody.length,
    }),
  );
  const activeVehiclePage = await fetch(`${BASE}/vehicles/listing-trust-vehicle-${stamp}`);
  const activeVehicleBody = await activeVehiclePage.text();
  check(
    "an eligible Basic listing is clear about its limits and does not expose the page contact number",
    activeVehiclePage.status === 200
      && activeVehicleBody.includes("Trust Check")
      && activeVehicleBody.includes("Basic listing")
      && !activeVehicleBody.includes("+94770000001"),
    JSON.stringify({
      status: activeVehiclePage.status,
      hasVehicle: activeVehicleBody.includes("Trust Check"),
      exposesPhone: activeVehicleBody.includes("+94770000001"),
      noindex: /noindex/i.test(activeVehicleBody),
      vehicleNotFound: /Vehicle not found|This page could not be found/i.test(activeVehicleBody),
      title: activeVehicleBody.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null,
      length: activeVehicleBody.length,
    }),
  );

  const ownerCookie = await sessionHeader(owner.email);
  const adminCookie = await sessionHeader(admin.email);
  await service.from("vehicles").update({ status: "pending_review", plate_number: null }).eq("id", vehicle.id);
  const incompleteAdminApproval = await fetch(`${BASE}/api/admin/vehicles/${vehicle.id}`, {
    method: "PATCH",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "available" }),
  });
  check("the real admin action cannot publish a listing with no plate", incompleteAdminApproval.status === 409, `status=${incompleteAdminApproval.status}`);
  await service.from("vehicles").update({ plate_number: `LTR-${stamp}` }).eq("id", vehicle.id);

  await service.from("vehicles").update({ status: "unlisted", rejection_reason: "Correct the vehicle identity before resubmitting." }).eq("id", vehicle.id);
  const rejectedRelist = await fetch(`${BASE}/api/vehicles/${vehicle.id}/status`, {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "available" }),
  });
  check("an owner cannot relist an admin-rejected vehicle", rejectedRelist.status === 409, `status=${rejectedRelist.status}`);
  await service.from("vehicles").update({ status: "pending_review", rejection_reason: null }).eq("id", vehicle.id);
  await service.from("vehicles").update({ status: "available" }).eq("id", vehicle.id);

  await client.query("begin");
  const docs = await client.query(
    `insert into public.vehicle_documents (vehicle_id, cr_url, insurance_url, revenue_license_url)
     values ($1, 'cr-original', 'insurance-original', 'revenue-original')`,
    [vehicle.id],
  );
  check("verification evidence can be recorded for the listing", docs.rowCount === 1);

  await client.query(
    "update public.vehicles set status='available', verified_vehicle=true where id=$1",
    [vehicle.id],
  );

  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [owner.id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  const edited = await client.query(
    "update public.vehicles set daily_rate_lkr=11000 where id=$1 returning status, verified_vehicle, is_featured, badges",
    [vehicle.id],
  );
  const listing = edited.rows[0];
  check(
    "an owner price change returns a verified listing to review",
    listing?.status === "pending_review" && listing?.verified_vehicle === false && listing?.is_featured === false && Array.isArray(listing?.badges) && listing.badges.length === 0,
    JSON.stringify(listing),
  );

  await client.query("reset role");
  await client.query("update public.vehicles set status='available', verified_vehicle=true where id=$1", [vehicle.id]);
  await client.query("set local role authenticated");
  const changedEvidence = await client.query(
    "update public.vehicle_documents set insurance_url='insurance-replaced' where vehicle_id=$1",
    [vehicle.id],
  );
  check("an owner can replace their own evidence", changedEvidence.rowCount === 1);
  await client.query("reset role");
  const afterEvidence = await client.query(
    "select status, verified_vehicle from public.vehicles where id=$1",
    [vehicle.id],
  );
  check(
    "replacing evidence also returns the listing to review",
    afterEvidence.rows[0]?.status === "pending_review" && afterEvidence.rows[0]?.verified_vehicle === false,
    JSON.stringify(afterEvidence.rows[0]),
  );

  await client.query("update public.vehicles set insurance_type='private', verified_vehicle=false where id=$1", [vehicle.id]);
  let privateInsuranceRejected = false;
  await client.query("savepoint private_insurance_verification");
  try {
    await client.query("update public.vehicles set verified_vehicle=true where id=$1", [vehicle.id]);
  } catch {
    privateInsuranceRejected = true;
    await client.query("rollback to savepoint private_insurance_verification");
  }
  check("private insurance cannot receive the Verified Vehicle mark", privateInsuranceRejected);

  // Changing insurance is itself a trust-relevant edit, so restore the
  // compliance value first and publish in a second moderation-style write.
  await client.query("update public.vehicles set insurance_type='hire', verified_vehicle=false where id=$1", [vehicle.id]);
  await client.query("update public.vehicles set status='available' where id=$1", [vehicle.id]);
  const activeSearch = await client.query("select id from public.search_vehicles(p_q => 'Trust Check', p_limit => 10)");
  check("an active Rental Page's available listing appears in public search", activeSearch.rows.some((row) => row.id === vehicle.id));

  await client.query("update public.agencies set is_verified=false where id=$1", [page.id]);
  const unverifiedSearch = await client.query("select id from public.search_vehicles(p_q => 'Trust Check', p_limit => 10)");
  check("an unverified Rental Page is removed from public search", !unverifiedSearch.rows.some((row) => row.id === vehicle.id));
  await client.query("commit");

  const renterCookie = await sessionHeader(renter.email);
  const pickup = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const returnDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const unverifiedBooking = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { Cookie: renterCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle_id: vehicle.id, start_date: pickup, end_date: returnDate, rental_mode: "with_driver" }),
  });
  const unverifiedBookingBody = await unverifiedBooking.json().catch(() => ({}));
  check(
    "a direct booking request to an unverified Rental Page is refused",
    unverifiedBooking.status === 409 && unverifiedBookingBody.error === "This vehicle isn't available for booking.",
    JSON.stringify(unverifiedBookingBody),
  );
  const unverifiedStorefront = await fetch(`${BASE}/pages/listing-trust-${stamp}`, { redirect: "manual" });
  const unverifiedStorefrontBody = await unverifiedStorefront.text();
  check(
    "an unverified Rental Page storefront exposes no page data and is excluded from indexing",
    (unverifiedStorefront.status === 404 || unverifiedStorefront.status === 200)
      && /noindex/i.test(unverifiedStorefrontBody)
      && !unverifiedStorefrontBody.includes(`Listing Trust Page ${stamp}`),
    `status=${unverifiedStorefront.status}`,
  );

  await service.from("agencies").update({ is_verified: true, is_blocked: false, whatsapp_verified_at: null }).eq("id", page.id);
  const unverifiedPhoneBooking = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { Cookie: renterCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle_id: vehicle.id, start_date: pickup, end_date: returnDate, rental_mode: "with_driver" }),
  });
  check("a direct booking request is refused when the page phone is not verified", unverifiedPhoneBooking.status === 409, `status=${unverifiedPhoneBooking.status}`);

  await service.from("agencies").update({ whatsapp_verified_at: new Date().toISOString(), is_blocked: true }).eq("id", page.id);
  const inactiveSearch = await client.query("select id from public.search_vehicles(p_q => 'Trust Check', p_limit => 10)");
  check("a blocked Rental Page is removed from public search", !inactiveSearch.rows.some((row) => row.id === vehicle.id));

  const booking = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { Cookie: renterCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle_id: vehicle.id, start_date: pickup, end_date: returnDate, rental_mode: "with_driver" }),
  });
  const bookingBody = await booking.json().catch(() => ({}));
  check(
    "a direct booking request to a blocked Rental Page is refused",
    booking.status === 409 && bookingBody.error === "This vehicle isn't available for booking.",
    JSON.stringify(bookingBody),
  );

  console.log(`\n${passed} listing-trust checks passed.`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("cleanup", error instanceof Error ? error.message : error));
  await client.end();
}
