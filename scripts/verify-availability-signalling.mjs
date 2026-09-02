#!/usr/bin/env node
/*
 * Date-filtered search must SHOW vehicles that are already taken, flagged,
 * rather than dropping them.
 *
 * The old behaviour filtered them out, which from a renter's side looks like
 * the vehicle does not exist. This seeds a real clash - one confirmed booking
 * and one provider block - and asserts what an anonymous caller sees.
 *
 * Everything created here is removed again, including on failure.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let passed = 0;
const failures = [];
function check(label, condition, detail = "") {
  if (condition) { passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`); }
  else { failures.push(`${label}${detail ? `: ${detail}` : ""}`); console.log(`FAIL    ${label}${detail ? `: ${detail}` : ""}`); }
}

// Dates far enough out that nothing real collides with them.
const day = (offset) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const CLASH_FROM = day(40), CLASH_TO = day(43);
const FREE_FROM = day(80), FREE_TO = day(83);

const created = { userIds: [], agencyIds: [], vehicleIds: [], bookingIds: [], blockIds: [] };

async function seedVehicle(label, city) {
  const { data: agency, error: agencyError } = await service.from("agencies").insert({
    owner_id: created.userIds[0], name: `Availability ${label} ${stamp}`,
    slug: `availability-${label}-${stamp}`, city, whatsapp_number: "+94770000000",
    page_type: "personal", email: `avail-${label}-${stamp}@drivelink.invalid`,
    is_verified: true, whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (agencyError) throw agencyError;
  created.agencyIds.push(agency.id);

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: `Probe-${label}`, year: 2020,
    slug: `avail-${label}-${stamp}`, status: "available", vehicle_type: "car",
    daily_rate_lkr: 7000, deposit_lkr: 20000, seats: 5, transmission: "automatic",
    city, insurance_type: "hire", self_drive: true, with_driver: false,
    plate_number: `WP ${label.slice(0, 2).toUpperCase()}-${stamp.slice(-4)}`, fuel_type: "petrol", engine_cc: 1500, doors: 4,
    photos: ["https://example.invalid/1.jpg", "https://example.invalid/2.jpg",
             "https://example.invalid/3.jpg", "https://example.invalid/4.jpg"],
    // The declaration trigger only stamps these for a real signed-in owner or
    // manager. Seeding under the service role skips that path, so the stamp is
    // written directly - vehicle_listing_ready_for_public() requires all three.
    listing_authority_basis: "registered_owner", listing_authority_declared: true,
    listing_authority_confirmed_at: new Date().toISOString(),
    listing_authority_confirmed_by: created.userIds[0],
    listing_authority_declaration_version: "vehicle-authority-v1",
  }).select("id, slug").single();
  if (vehicleError) throw vehicleError;
  created.vehicleIds.push(vehicle.id);
  return { agencyId: agency.id, vehicleId: vehicle.id, slug: vehicle.slug };
}

const find = (rows, slug) => (rows ?? []).find((v) => v.slug === slug);

try {
  const { data: owner, error: ownerError } = await service.auth.admin.createUser({
    email: `availability-${stamp}@phone.drivelink.invalid`, password: `Avail-${stamp}-1!`,
    email_confirm: true, user_metadata: { full_name: "Availability Probe", phone: `+9471${String(Date.now()).slice(-7)}` },
  });
  if (ownerError) throw ownerError;
  created.userIds.push(owner.user.id);
  await service.from("profiles").update({ kyc_status: "verified" }).eq("id", owner.user.id);

  const city = `Probeville${stamp}`;
  const bookedVehicle = await seedVehicle("booked", city);
  const blockedVehicle = await seedVehicle("blocked", city);
  const freeVehicle = await seedVehicle("free", city);

  // A renter, and a confirmed booking that covers the clash window.
  const { data: renter, error: renterError } = await service.auth.admin.createUser({
    email: `availability-renter-${stamp}@phone.drivelink.invalid`, password: `Avail-${stamp}-2!`,
    email_confirm: true, user_metadata: { full_name: "Availability Renter", phone: `+9472${String(Date.now()).slice(-7)}` },
  });
  if (renterError) throw renterError;
  created.userIds.push(renter.user.id);

  const { data: booking, error: bookingError } = await service.from("bookings").insert({
    vehicle_id: bookedVehicle.vehicleId, agency_id: bookedVehicle.agencyId, renter_id: renter.user.id,
    start_date: CLASH_FROM, end_date: CLASH_TO, start_time: "10:00", end_time: "10:00",
    status: "confirmed", daily_rate_lkr: 7000,
  }).select("id").single();
  if (bookingError) throw bookingError;
  created.bookingIds.push(booking.id);

  const { data: block, error: blockError } = await service.from("vehicle_blocks").insert({
    vehicle_id: blockedVehicle.vehicleId, agency_id: blockedVehicle.agencyId,
    start_date: CLASH_FROM, end_date: CLASH_TO, reason: "probe",
  }).select("id").single();
  if (blockError) throw blockError;
  created.blockIds.push(block.id);

  // ── The clashing search, as an anonymous visitor ──
  const { data: clash, error: clashError } = await anon.rpc("search_vehicles", {
    p_city: city, p_from: CLASH_FROM, p_to: CLASH_TO, p_limit: 20, p_offset: 0,
  });
  if (clashError) throw clashError;

  const bookedRow = find(clash, bookedVehicle.slug);
  const blockedRow = find(clash, blockedVehicle.slug);
  const freeRow = find(clash, freeVehicle.slug);

  check("a booked vehicle is still returned, not filtered out", Boolean(bookedRow));
  check("a blocked vehicle is still returned, not filtered out", Boolean(blockedRow));
  check("a free vehicle is returned", Boolean(freeRow));
  check("the booked vehicle is flagged booked_in_range", bookedRow?.booked_in_range === true, String(bookedRow?.booked_in_range));
  check("the booked vehicle is not flagged blocked", bookedRow?.blocked_in_range === false, String(bookedRow?.blocked_in_range));
  check("the blocked vehicle is flagged blocked_in_range", blockedRow?.blocked_in_range === true, String(blockedRow?.blocked_in_range));
  check("the blocked vehicle is not flagged booked", blockedRow?.booked_in_range === false, String(blockedRow?.booked_in_range));
  check("the free vehicle carries neither flag",
    freeRow?.booked_in_range === false && freeRow?.blocked_in_range === false);

  const clashSlugs = (clash ?? []).map((v) => v.slug);
  check("bookable vehicles are ordered before unavailable ones",
    clashSlugs.indexOf(freeVehicle.slug) < clashSlugs.indexOf(bookedVehicle.slug),
    clashSlugs.join(", "));

  // ── A window nothing touches ──
  const { data: free, error: freeError } = await anon.rpc("search_vehicles", {
    p_city: city, p_from: FREE_FROM, p_to: FREE_TO, p_limit: 20, p_offset: 0,
  });
  if (freeError) throw freeError;
  check("all three are bookable outside the clash window",
    (free ?? []).length === 3 && (free ?? []).every((v) => !v.booked_in_range && !v.blocked_in_range));

  // ── No dates at all ──
  const { data: undated, error: undatedError } = await anon.rpc("search_vehicles", {
    p_city: city, p_limit: 20, p_offset: 0,
  });
  if (undatedError) throw undatedError;
  check("an undated search flags nothing as unavailable",
    (undated ?? []).length === 3 && (undated ?? []).every((v) => !v.booked_in_range && !v.blocked_in_range));

  // ── The flags must not leak anything else ──
  check("the plate stays redacted for anonymous callers",
    (clash ?? []).every((v) => v.plate_number === null));
  check("no renter identity rides along with the flags",
    (clash ?? []).every((v) => !("renter_id" in v) && !("booking_id" in v)));
} finally {
  for (const id of created.blockIds) await service.from("vehicle_blocks").delete().eq("id", id);
  for (const id of created.bookingIds) await service.from("bookings").delete().eq("id", id);
  for (const id of created.vehicleIds) await service.from("vehicles").delete().eq("id", id);
  for (const id of created.agencyIds) await service.from("agencies").delete().eq("id", id);
  for (const id of created.userIds) await service.auth.admin.deleteUser(id);
  console.log(`\ncleaned up: ${created.vehicleIds.length} vehicles, ${created.bookingIds.length} bookings, ${created.blockIds.length} blocks, ${created.agencyIds.length} pages, ${created.userIds.length} users`);
}

if (failures.length) {
  console.log(`\nAVAILABILITY SIGNALLING: ${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`\nAVAILABILITY SIGNALLING: ${passed} checks passed.`);
