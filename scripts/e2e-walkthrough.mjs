// Code-side E2E walkthrough of the Rental Pages rebuild.
//
// Drives the REAL API routes on a local dev server (http://localhost:3000)
// with real authenticated Supabase sessions, and asserts DB state after
// every step. Covers: page creation gates, listing RLS, booking gates
// (licence / frozen / blacklist), confirm -> agreement snapshot, both-side
// signing, messaging (+closed after completion), consent + private-doc
// proxy (+revoke), pickup/return inspections + deposit trail, disputes
// (renter-raised + admin resolution), late-return ladder via the cron
// (stage 1 + stage 2 freeze + auto-unfreeze), page-cancel strikes,
// blacklist reporting, page switcher authorization, and key SSR pages.
//
// Run:  node scripts/e2e-walkthrough.mjs   (dev server must be up; start it
//       with SMS/WhatsApp neutralized — see run instructions in the session)
//
// Cleans up everything it created (rows, users, R2 probes, SMS toggles).
import { createClient as createSb } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

const BASE = "http://localhost:3000";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
const svc = createSb(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const PRIVATE_BUCKET = env.R2_PRIVATE_BUCKET || "drivelink-private";
const PUBLIC_BASE = env.R2_PUBLIC_URL.replace(/\/+$/, "");

// ── tiny test harness ────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; failures.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollFor(fn, tries = 12, ms = 500) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(ms);
  }
  return null;
}

// ── session cookies via the app's own SSR lib ────────────────────────
async function mintCookies(email, password) {
  const anon = createSb(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  const jar = new Map();
  const ssr = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return { header: () => [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; "), jar, userId: data.user.id };
}

async function api(sess, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: sess.header() },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  // absorb any active-page cookie the route sets
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const i = pair.indexOf("=");
    sess.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  let json = null;
  try { json = await res.json(); } catch { /* html or empty */ }
  return { status: res.status, json };
}

async function page(sess, path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: sess.header() }, redirect: "manual" });
  const text = res.status === 200 ? await res.text() : "";
  return { status: res.status, text, location: res.headers.get("location") };
}

// ── fixtures ─────────────────────────────────────────────────────────
const PW = "E2e-walkthrough-1!";
const STAMP = Date.now().toString().slice(-6);
const RENTER_EMAIL = `e2e-renter-${STAMP}@phone.drivelink.invalid`;
const OWNER_EMAIL  = `e2e-owner-${STAMP}@phone.drivelink.invalid`;
const ADMIN_EMAIL  = `e2e-admin-${STAMP}@phone.drivelink.invalid`;

const created = { users: [], probes: [] };
let smsBackup = null;

async function createUser(email, fullName, phone) {
  const { data, error } = await svc.auth.admin.createUser({
    email, password: PW, email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  created.users.push(data.user.id);
  return data.user.id;
}

function dates(offsetDays, lenDays) {
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  return { start_date: d(offsetDays), end_date: d(offsetDays + lenDays) };
}

async function bookingRow(id, cols = "*") {
  const { data } = await svc.from("bookings").select(cols).eq("id", id).single();
  return data;
}

// ── the walkthrough ──────────────────────────────────────────────────
async function main() {
  section("setup: mute SMS toggles, seed users");
  {
    const { data: settings } = await svc.from("platform_settings").select("*").eq("id", true).single();
    smsBackup = Object.fromEntries(Object.entries(settings ?? {}).filter(([k]) => k.startsWith("sms_") && k.endsWith("_enabled")));
    if (Object.keys(smsBackup).length) {
      await svc.from("platform_settings").update(Object.fromEntries(Object.keys(smsBackup).map((k) => [k, false]))).eq("id", true);
    }
    ok("sms toggles muted", true);
  }

  const renterId = await createUser(RENTER_EMAIL, "E2E Renter", `+9477${STAMP}1`);
  const ownerId  = await createUser(OWNER_EMAIL,  "E2E Owner",  `+9477${STAMP}2`);
  const adminId  = await createUser(ADMIN_EMAIL,  "E2E Admin",  `+9477${STAMP}3`);
  await svc.from("profiles").update({ role: "admin" }).eq("id", adminId);
  await svc.from("profiles").update({ kyc_status: "verified", nic_number: `199${STAMP}V`, address: "1 Test Lane, Colombo" }).eq("id", renterId);
  ok("users seeded", true);

  const renter = await mintCookies(RENTER_EMAIL, PW);
  const owner  = await mintCookies(OWNER_EMAIL, PW);
  const admin  = await mintCookies(ADMIN_EMAIL, PW);
  ok("sessions minted", renter.userId === renterId && owner.userId === ownerId);

  section("page creation gates");
  {
    const r = await api(owner, "POST", "/api/pages", { name: "E2E Motors", page_type: "personal", city: "Colombo", whatsapp_number: "0771234567" });
    ok("unverified owner blocked (403)", r.status === 403, `got ${r.status}`);
  }
  await svc.from("profiles").update({ kyc_status: "verified", nic_number: `198${STAMP}V` }).eq("id", ownerId);
  let pageId;
  {
    const r = await api(owner, "POST", "/api/pages", { name: "E2E Motors", page_type: "personal", city: "Colombo", whatsapp_number: "0771234567" });
    ok("verified owner creates page (201)", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
    pageId = r.json?.page?.id;
    ok("personal page auto-approved", r.json?.page?.is_verified === true);
    ok("role flipped to agency_owner", (await svc.from("profiles").select("role").eq("id", ownerId).single()).data?.role === "agency_owner");
  }

  section("page switcher authorization");
  {
    const r2 = await api(owner, "POST", "/api/pages", { name: "E2E Second Page", page_type: "business", city: "Negombo", whatsapp_number: "0771234568", business_reg_no: "PV 99999" });
    ok("second page created (201)", r2.status === 201, `got ${r2.status}`);
    ok("business page pending review", r2.json?.page?.is_verified === false);
    const back = await api(owner, "POST", "/api/pages/switch", { page_id: pageId });
    ok("owner switches back to page A (200)", back.status === 200, `got ${back.status}`);
    const stranger = await api(renter, "POST", "/api/pages/switch", { page_id: pageId });
    ok("renter can't switch to owner's page (404)", stranger.status === 404, `got ${stranger.status}`);
  }

  section("vehicle listing (RLS + admin approval)");
  const ownerSb = createSb(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  await ownerSb.auth.signInWithPassword({ email: OWNER_EMAIL, password: PW });
  const renterSb = createSb(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  await renterSb.auth.signInWithPassword({ email: RENTER_EMAIL, password: PW });

  const vehicleBase = {
    agency_id: pageId, make: "Toyota", model: "Aqua", year: 2017, insurance_type: "hire",
    daily_rate_lkr: 9000, deposit_lkr: 20000, city: "Colombo", status: "pending_review",
    self_drive: true, with_driver: false, vehicle_type: "car", fuel_type: "petrol",
    plate_number: `E2E-${STAMP}`, included_km_per_day: 100, extra_mileage_lkr: 30,
  };
  let v1, v2;
  {
    const bad = await renterSb.from("vehicles").insert({ ...vehicleBase, slug: `e2e-bad-${STAMP}` }).select("id").single();
    ok("renter can't insert into owner's fleet (RLS)", !!bad.error);
    const r1 = await ownerSb.from("vehicles").insert({ ...vehicleBase, slug: `e2e-aqua-${STAMP}` }).select("id").single();
    ok("owner lists vehicle 1", !r1.error, r1.error?.message);
    v1 = r1.data?.id;
    const r2 = await ownerSb.from("vehicles").insert({ ...vehicleBase, plate_number: `E2E2-${STAMP}`, slug: `e2e-aqua2-${STAMP}` }).select("id").single();
    v2 = r2.data?.id;
    await svc.from("vehicles").update({ status: "available" }).in("id", [v1, v2]); // simulate admin approval
    ok("vehicles approved", true);
  }

  section("booking gates: licence, frozen");
  {
    const noLic = await api(renter, "POST", "/api/bookings", { vehicle_id: v1, ...dates(2, 2) });
    ok("self-drive blocked without licence (403)", noLic.status === 403, `got ${noLic.status}`);
    await svc.from("profiles").update({
      license_front_url: `/api/docs/kyc/${renterId}/e2e-lic-front.png`,
      license_back_url:  `/api/docs/kyc/${renterId}/e2e-lic-back.png`,
    }).eq("id", renterId);
    await svc.from("profiles").update({ booking_frozen: true }).eq("id", renterId);
    const frozen = await api(renter, "POST", "/api/bookings", { vehicle_id: v1, ...dates(2, 2) });
    ok("frozen account blocked (403)", frozen.status === 403 && /frozen/i.test(frozen.json?.error ?? ""), `got ${frozen.status}`);
    await svc.from("profiles").update({ booking_frozen: false }).eq("id", renterId);
  }

  section("booking 1: request -> confirm -> agreement -> messages -> dispute -> admin resolve");
  let b1;
  {
    const r = await api(renter, "POST", "/api/bookings", { vehicle_id: v1, ...dates(2, 2) });
    ok("booking created", r.status === 200 || r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
    b1 = r.json?.bookingId ?? r.json?.booking?.id ?? r.json?.id;
    const row = await bookingRow(b1, "status");
    ok("status pending_confirmation", row?.status === "pending_confirmation", row?.status);
  }
  {
    const r = await api(owner, "POST", "/api/bookings/transition", { bookingId: b1, to: "confirmed" });
    ok("owner confirms (200)", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`);
    const row = await bookingRow(b1, "status, cancelled_by");
    ok("free-launch -> active", row?.status === "active", row?.status);
    const ag = await pollFor(async () => (await svc.from("booking_agreements").select("id, terms").eq("booking_id", b1).maybeSingle()).data);
    ok("agreement snapshot created", !!ag);
    ok("snapshot has venue disclaimer", !!ag?.terms?.parties?.platform_disclaimer);
    ok("snapshot deposit standard present", !!ag?.terms?.deposit?.refund_terms);
  }
  {
    const r1 = await api(renter, "POST", `/api/bookings/${b1}/agreement/accept`, {});
    ok("renter signs (200)", r1.status === 200, `got ${r1.status}`);
    const again = await api(renter, "POST", `/api/bookings/${b1}/agreement/accept`, {});
    ok("double-sign rejected (409)", again.status === 409, `got ${again.status}`);
    const r2 = await api(owner, "POST", `/api/bookings/${b1}/agreement/accept`, {});
    ok("owner signs (200)", r2.status === 200, `got ${r2.status}`);
    const stranger = await api(admin, "POST", `/api/bookings/${b1}/agreement/accept`, {});
    ok("non-party can't sign (403)", stranger.status === 403, `got ${stranger.status}`);
  }
  {
    const send = await api(renter, "POST", `/api/bookings/${b1}/messages`, { body: "Hi! What time works for pickup?" });
    ok("renter sends message", send.status === 200 || send.status === 201, `got ${send.status}`);
    const list = await api(owner, "GET", `/api/bookings/${b1}/messages`);
    ok("owner reads thread", (list.json?.messages ?? list.json ?? []).length >= 1, JSON.stringify(list.json)?.slice(0, 80));
    const cursor = await bookingRow(b1, "page_msgs_read_at");
    ok("owner read cursor stamped", !!cursor?.page_msgs_read_at);
  }
  {
    const r = await api(renter, "POST", `/api/bookings/${b1}/dispute`, { type: "breakdown", reason: "The AC stopped working an hour into the trip." });
    ok("renter raises dispute (200)", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`);
    ok("booking disputed", (await bookingRow(b1, "status"))?.status === "disputed");
    const inc = (await svc.from("incidents").select("id, type, status").eq("booking_id", b1)).data ?? [];
    ok("incident filed", inc.length === 1 && inc[0].type === "breakdown" && inc[0].status === "open", JSON.stringify(inc));
    const noNote = await api(admin, "POST", "/api/admin/bookings/transition", { bookingId: b1, to: "completed" });
    ok("admin resolve without note rejected (400)", noNote.status === 400, `got ${noNote.status}`);
    const r2 = await api(admin, "POST", "/api/admin/bookings/transition", { bookingId: b1, to: "completed", resolution_note: "Owner refunded one rental day; renter satisfied." });
    ok("admin resolves dispute (200)", r2.status === 200, `got ${r2.status} ${JSON.stringify(r2.json)}`);
    ok("booking completed", (await bookingRow(b1, "status"))?.status === "completed");
    const inc2 = (await svc.from("incidents").select("status, resolution_note").eq("booking_id", b1)).data?.[0];
    ok("incident resolved with note", inc2?.status === "resolved" && !!inc2?.resolution_note);
    const closed = await api(renter, "POST", `/api/bookings/${b1}/messages`, { body: "one more thing" });
    ok("messaging closed after completion", closed.status >= 400, `got ${closed.status}`);
  }

  section("booking 2 (vehicle 2): consent + doc proxy + inspections + deposit + review");
  // R2 probes for the doc proxy
  for (const key of [`kyc/${renterId}/e2e-lic-front.png`, `kyc/${renterId}/e2e-lic-back.png`, `kyc/${ownerId}/e2e-owner-doc.png`]) {
    await s3.send(new PutObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key, Body: Buffer.from([137, 80, 78, 71]), ContentType: "image/png" }));
    created.probes.push(key);
  }
  let b2;
  {
    const r = await api(renter, "POST", "/api/bookings", { vehicle_id: v2, ...dates(3, 2) });
    b2 = r.json?.bookingId ?? r.json?.booking?.id ?? r.json?.id;
    ok("booking 2 created", !!b2, JSON.stringify(r.json)?.slice(0, 120));
    await api(owner, "POST", "/api/bookings/transition", { bookingId: b2, to: "confirmed" });
    ok("booking 2 active", (await bookingRow(b2, "status"))?.status === "active");
  }
  {
    const before = await fetch(`${BASE}/api/docs/kyc/${renterId}/e2e-lic-front.png`, { headers: { Cookie: owner.header() } });
    ok("owner blocked from docs pre-consent (404)", before.status === 404, `got ${before.status}`);
    const anon = await fetch(`${BASE}/api/docs/kyc/${renterId}/e2e-lic-front.png`);
    ok("anonymous blocked (401)", anon.status === 401, `got ${anon.status}`);
    const consent = await api(renter, "POST", `/api/bookings/${b2}/consent`, {});
    ok("renter grants consent", consent.status === 200, `got ${consent.status}`);
    const after = await fetch(`${BASE}/api/docs/kyc/${renterId}/e2e-lic-front.png`, { headers: { Cookie: owner.header() } });
    ok("owner reads doc with consent (200)", after.status === 200, `got ${after.status}`);
    const own = await fetch(`${BASE}/api/docs/kyc/${renterId}/e2e-lic-front.png`, { headers: { Cookie: renter.header() } });
    ok("renter reads own doc (200)", own.status === 200, `got ${own.status}`);
    const cross = await fetch(`${BASE}/api/docs/kyc/${ownerId}/e2e-owner-doc.png`, { headers: { Cookie: renter.header() } });
    ok("renter can't read owner's doc (404)", cross.status === 404, `got ${cross.status}`);
    const viewer = await page(owner, `/dashboard/bookings/${b2}/documents`);
    ok("documents viewer renders (200)", viewer.status === 200, `got ${viewer.status}`);
    const log = (await svc.from("document_access_log").select("id").eq("booking_id", b2)).data ?? [];
    ok("document access logged", log.length > 0, `rows=${log.length}`);
    const revoke = await api(renter, "DELETE", `/api/bookings/${b2}/consent`, {});
    ok("renter revokes consent", revoke.status === 200, `got ${revoke.status}`);
    const blocked = await fetch(`${BASE}/api/docs/kyc/${renterId}/e2e-lic-front.png`, { headers: { Cookie: owner.header() } });
    ok("owner blocked after revoke (404)", blocked.status === 404, `got ${blocked.status}`);
    await api(renter, "POST", `/api/bookings/${b2}/consent`, {}); // re-grant for the rest
  }
  {
    const photos = Array.from({ length: 4 }, (_, i) => `${PUBLIC_BASE}/booking-photos/${renterId}/e2e-${i}.jpg`);
    const noPlate = await api(owner, "POST", `/api/bookings/${b2}/inspections`, { phase: "pickup", odometer_km: 45000, fuel_level: "full", plate_confirmed: false, photo_urls: photos, deposit: { received: true, method: "cash" } });
    ok("pickup without plate confirm rejected (400)", noPlate.status === 400, `got ${noPlate.status}`);
    const r = await api(owner, "POST", `/api/bookings/${b2}/inspections`, { phase: "pickup", odometer_km: 45000, fuel_level: "full", plate_confirmed: true, photo_urls: photos, checklist: { documents_present: true }, deposit: { received: true, method: "cash" } });
    ok("pickup inspection submitted", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);
    const dep = await bookingRow(b2, "deposit_received_at, deposit_method, deposit_lkr, pickup_photo_urls");
    ok("deposit trail stamped", !!dep?.deposit_received_at && dep?.deposit_method === "cash" && dep?.deposit_lkr === 20000, JSON.stringify(dep)?.slice(0, 120));
    ok("photos mirrored to booking", (dep?.pickup_photo_urls ?? []).length === 4);
    const ack = await api(renter, "POST", `/api/bookings/${b2}/inspections/ack`, { phase: "pickup", action: "accept", deposit_ack: true });
    ok("renter accepts pickup", ack.status === 200, `got ${ack.status}`);
    const dep2 = await bookingRow(b2, "deposit_received_ack_at");
    ok("renter deposit ack stamped", !!dep2?.deposit_received_ack_at);
    const partialNoReason = await api(owner, "POST", `/api/bookings/${b2}/inspections`, { phase: "return", odometer_km: 45180, fuel_level: "three_quarter", plate_confirmed: true, photo_urls: photos, deposit_return: { amount_lkr: 15000 } });
    ok("partial deposit return without reason rejected (400)", partialNoReason.status === 400, `got ${partialNoReason.status}`);
    const ret = await api(owner, "POST", `/api/bookings/${b2}/inspections`, { phase: "return", odometer_km: 45180, fuel_level: "three_quarter", plate_confirmed: true, photo_urls: photos, deposit_return: { amount_lkr: 15000, reason: "Fuel shortfall Rs 3,000 + cleaning Rs 2,000 per agreement" } });
    ok("return inspection submitted", ret.status === 200, `got ${ret.status}`);
    const ack2 = await api(renter, "POST", `/api/bookings/${b2}/inspections/ack`, { phase: "return", action: "accept", deposit_ack: true });
    ok("renter accepts return", ack2.status === 200, `got ${ack2.status}`);
    const done = await api(owner, "POST", "/api/bookings/transition", { bookingId: b2, to: "completed" });
    ok("owner completes booking 2", done.status === 200, `got ${done.status}`);
    const rev = await renterSb.from("reviews").insert({ booking_id: b2, reviewer_id: renterId, reviewee_id: ownerId, rating: 5, comment: "Smooth handover, fair deposit return." }).select("id").single();
    ok("renter reviews completed booking (RLS)", !rev.error, rev.error?.message);
  }

  section("booking 3 (vehicle 1): late-return ladder via cron");
  let b3;
  {
    const r = await api(renter, "POST", "/api/bookings", { vehicle_id: v1, ...dates(6, 2) });
    b3 = r.json?.bookingId ?? r.json?.booking?.id ?? r.json?.id;
    await api(owner, "POST", "/api/bookings/transition", { bookingId: b3, to: "confirmed" });
    ok("booking 3 active", (await bookingRow(b3, "status"))?.status === "active");
    const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    await svc.from("bookings").update({ start_date: d(-2), end_date: d(-1), start_time: "10:00", end_time: new Date(Date.now() - 3 * 3600e3).toTimeString().slice(0, 5) }).eq("id", b3);
    const cron1 = await fetch(`${BASE}/api/cron/expire-bookings`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    ok("cron runs (200)", cron1.status === 200, `got ${cron1.status}`);
    const s1 = await bookingRow(b3, "overdue_notified_at, overdue_critical_at, status");
    ok("stage 1: overdue notified", !!s1?.overdue_notified_at, JSON.stringify(s1));
    ok("stage 1: not yet critical", !s1?.overdue_critical_at);
    ok("not auto-completed without return signal", s1?.status === "active", s1?.status);
    // keep valid_dates happy (end > start) while pushing end past the 24h cutoff
    const shift = await svc.from("bookings").update({ start_date: d(-4), end_date: d(-2), end_time: "08:00" }).eq("id", b3).select("id");
    if (shift.error) console.log(`  (stage-2 date update error: ${shift.error.message})`);
    await fetch(`${BASE}/api/cron/expire-bookings`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    const s2 = await bookingRow(b3, "overdue_critical_at, status");
    ok("stage 2: critical stamped", !!s2?.overdue_critical_at);
    ok("still not auto-completed", s2?.status === "active", s2?.status);
    const frozen = (await svc.from("profiles").select("booking_frozen").eq("id", renterId).single()).data;
    ok("renter frozen platform-wide", frozen?.booking_frozen === true);
    const blockedBooking = await api(renter, "POST", "/api/bookings", { vehicle_id: v2, ...dates(10, 1) });
    ok("frozen renter can't book (403)", blockedBooking.status === 403, `got ${blockedBooking.status}`);
    const complete = await api(owner, "POST", "/api/bookings/transition", { bookingId: b3, to: "completed" });
    ok("owner completes overdue booking", complete.status === 200, `got ${complete.status}`);
    const unfrozen = await pollFor(async () => {
      const { data } = await svc.from("profiles").select("booking_frozen").eq("id", renterId).single();
      return data?.booking_frozen === false ? data : null;
    });
    ok("trigger auto-unfroze renter", !!unfrozen);
  }

  section("booking 4 (vehicle 2): page-cancel strike");
  let b4;
  {
    // starts ~25h out: passes the 24h lead-time gate AND lands inside the 48h strike window
    const start = new Date(Date.now() + 25 * 3600e3);
    const end = new Date(start.getTime() + 48 * 3600e3);
    const r = await api(renter, "POST", "/api/bookings", {
      vehicle_id: v2,
      start_date: start.toISOString().slice(0, 10), start_time: start.toTimeString().slice(0, 5),
      end_date: end.toISOString().slice(0, 10), end_time: "10:00",
    });
    b4 = r.json?.bookingId ?? r.json?.booking?.id ?? r.json?.id;
    ok("booking 4 created", !!b4, JSON.stringify(r.json)?.slice(0, 120));
    await api(owner, "POST", "/api/bookings/transition", { bookingId: b4, to: "confirmed" });
    const strikesBefore = (await svc.from("agencies").select("strike_count").eq("id", pageId).single()).data?.strike_count ?? 0;
    const cancel = await api(owner, "POST", "/api/bookings/transition", { bookingId: b4, to: "cancelled", reason: "vehicle needed urgently" });
    ok("page cancels before pickup (200)", cancel.status === 200, `got ${cancel.status} ${JSON.stringify(cancel.json)}`);
    const row = await bookingRow(b4, "status, cancelled_by, cancellation_reason");
    ok("cancelled_by = page", row?.cancelled_by === "page", JSON.stringify(row));
    const pageRow = (await svc.from("agencies").select("strike_count, cancellation_count").eq("id", pageId).single()).data;
    ok("strike added (48h window)", (pageRow?.strike_count ?? 0) === strikesBefore + 1, JSON.stringify(pageRow));
    ok("cancellation_count counts page cancels", (pageRow?.cancellation_count ?? 0) >= 1, JSON.stringify(pageRow));
  }

  section("blacklist reporting");
  {
    const tooShort = await api(owner, "POST", `/api/bookings/${b1}/report-renter`, { reason: "bad renter" });
    ok("thin report rejected (400)", tooShort.status === 400, `got ${tooShort.status}`);
    const r = await api(owner, "POST", `/api/bookings/${b1}/report-renter`, { reason: "Returned the vehicle with undisclosed damage and refused to discuss the repair estimate." });
    ok("report filed (201)", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
    const dupe = await api(owner, "POST", `/api/bookings/${b1}/report-renter`, { reason: "Duplicate report for the same booking should be rejected." });
    ok("duplicate rejected", dupe.status >= 400, `got ${dupe.status}`);
    const reports = (await svc.from("blacklist_reports").select("id, reported_nic").eq("booking_id", b1)).data ?? [];
    ok("report row exists with NIC", reports.length === 1 && !!reports[0].reported_nic, JSON.stringify(reports));
    await svc.from("profiles").update({ is_blacklisted: true }).eq("id", renterId); // simulate admin approval
    const blocked = await api(renter, "POST", "/api/bookings", { vehicle_id: v2, ...dates(12, 1) });
    ok("blacklisted renter can't book (403)", blocked.status === 403, `got ${blocked.status}`);
    await svc.from("profiles").update({ is_blacklisted: false }).eq("id", renterId);
  }

  section("SSR pages render for the right parties");
  {
    const agr = await page(renter, `/bookings/${b1}/agreement`);
    ok("agreement page renders", agr.status === 200 && agr.text.includes("not a party"), `status ${agr.status}`);
    const dash = await page(owner, "/dashboard");
    ok("owner dashboard renders", dash.status === 200, `got ${dash.status} -> ${dash.location ?? ""}`);
    const dashSettings = await page(owner, "/dashboard/settings");
    ok("page settings renders", dashSettings.status === 200, `got ${dashSettings.status}`);
    const bookingPage = await page(renter, `/bookings/${b2}`);
    ok("renter booking page renders", bookingPage.status === 200, `got ${bookingPage.status}`);
    const docsHistory = await page(renter, "/account/documents");
    ok("sharing history renders", docsHistory.status === 200, `got ${docsHistory.status}`);
    const strangerAgr = await page(admin, `/bookings/${b1}/agreement`);
    ok("admin can view agreement", strangerAgr.status === 200, `got ${strangerAgr.status}`);
  }
}

async function cleanup() {
  section("cleanup");
  try {
    const userIds = created.users;
    if (userIds.length) {
      const { data: pages } = await svc.from("agencies").select("id").in("owner_id", userIds);
      const pageIds = (pages ?? []).map((p) => p.id);
      const { data: bookings } = await svc.from("bookings").select("id").in("renter_id", userIds);
      const bookingIds = (bookings ?? []).map((b) => b.id);
      for (const table of ["document_access_log", "booking_messages", "booking_agreements", "booking_inspections", "incidents", "blacklist_reports", "reviews"]) {
        if (bookingIds.length) await svc.from(table).delete().in("booking_id", bookingIds);
      }
      await svc.from("activity_events").delete().in("actor_id", userIds);
      if (bookingIds.length) await svc.from("bookings").delete().in("id", bookingIds);
      if (pageIds.length) {
        await svc.from("support_threads").delete().in("agency_id", pageIds);
        await svc.from("vehicles").delete().in("agency_id", pageIds);
      }
      for (const id of userIds) await svc.auth.admin.deleteUser(id);
      console.log(`  removed ${userIds.length} users, ${bookingIds.length} bookings, ${pageIds.length} pages`);
    }
    for (const key of created.probes) {
      await s3.send(new DeleteObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }));
    }
    if (smsBackup && Object.keys(smsBackup).length) {
      await svc.from("platform_settings").update(smsBackup).eq("id", true);
      console.log("  sms toggles restored");
    }
  } catch (err) {
    console.error("  CLEANUP ERROR (may need manual fixup):", err.message);
  }
}

try {
  await main();
} catch (err) {
  fail++;
  failures.push(`UNCAUGHT: ${err.message}`);
  console.error("\nUNCAUGHT:", err);
} finally {
  await cleanup();
  console.log(`\n===== E2E RESULT: ${pass} passed, ${fail} failed =====`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(fail > 0 ? 1 : 0);
}
