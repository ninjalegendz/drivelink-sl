// Frontend (browser) E2E walkthrough of the Rental Pages rebuild.
//
// Playwright + Chromium against the local dev server: real clicks through
// the real UI, with structural assertions that the shipped screens match
// the blueprint (universal signup, Rental Pages, Terms Engine panel,
// agreement + police mode, inspections, messaging, dispute + admin
// resolution). DB assertions via the service client where the UI's
// side-effects land. Self-cleaning, SMS toggles muted around the run.
//
// Run: node scripts/e2e-frontend.mjs   (dev server up with messaging
//      env neutralized, same as e2e-walkthrough.mjs)
import { chromium } from "playwright";
import { createClient as createSb } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import fs from "fs";

const BASE = "http://localhost:3000";
const SHOTS = "e2e-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const svc = createSb(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; failures.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PW = "E2e-frontend-1!";
const STAMP = Date.now().toString().slice(-6);
const created = { users: [] };
let smsBackup = null;

async function createUser(email, fullName, phone) {
  const { data, error } = await svc.auth.admin.createUser({
    email, password: PW, email_confirm: true, user_metadata: { full_name: fullName, phone },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  created.users.push(data.user.id);
  return data.user.id;
}

async function cookiesFor(email) {
  const anon = createSb(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`sign-in: ${error.message}`);
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return [...jar.entries()].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }));
}

// 1x1 transparent PNG for photo inputs
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const photoFiles = (n) => Array.from({ length: n }, (_, i) => ({ name: `e2e-${i}.png`, mimeType: "image/png", buffer: PNG }));

const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function shot(pg, name) { await pg.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }).catch(() => {}); }

// Wait out the route-group loading.tsx skeletons + hydration before reading text.
async function settled(pg) {
  await pg.waitForLoadState("networkidle").catch(() => {});
  await pg.waitForFunction(() => !document.body.innerText.includes("Loading..."), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
}

async function pollDb(fn, tries = 14, ms = 500) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(ms);
  }
  return null;
}

async function main() {
  section("setup");
  {
    const { data: settings } = await svc.from("platform_settings").select("*").eq("id", true).single();
    smsBackup = Object.fromEntries(Object.entries(settings ?? {}).filter(([k]) => k.startsWith("sms_") && k.endsWith("_enabled")));
    if (Object.keys(smsBackup).length) {
      await svc.from("platform_settings").update(Object.fromEntries(Object.keys(smsBackup).map((k) => [k, false]))).eq("id", true);
    }
  }
  const renterId = await createUser(`fe-renter-${STAMP}@phone.drivelink.invalid`, "FE Renter", `+9476${STAMP}1`);
  const ownerId  = await createUser(`fe-owner-${STAMP}@phone.drivelink.invalid`, "FE Owner", `+9476${STAMP}2`);
  const adminId  = await createUser(`fe-admin-${STAMP}@phone.drivelink.invalid`, "FE Admin", `+9476${STAMP}3`);
  await svc.from("profiles").update({ role: "admin" }).eq("id", adminId);
  await svc.from("profiles").update({
    kyc_status: "verified", nic_number: `199${STAMP}V`, address: "1 Test Lane, Colombo",
    license_front_url: `/api/docs/kyc/${renterId}/fe-lic-f.png`, license_back_url: `/api/docs/kyc/${renterId}/fe-lic-b.png`,
  }).eq("id", renterId);
  await svc.from("profiles").update({ kyc_status: "verified", nic_number: `198${STAMP}V` }).eq("id", ownerId);
  ok("users seeded", true);

  const browser = await chromium.launch();
  const mk = async (cookies) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (cookies) await ctx.addCookies(cookies);
    const pg = await ctx.newPage();
    pg.setDefaultTimeout(15000);
    return pg;
  };

  try {
    // ── public structure ─────────────────────────────────────────────
    section("public: home, universal signup, terms, pricing, footer");
    const pub = await mk(null);
    await pub.goto(`${BASE}/`);
    ok("home renders", await pub.locator("body").count() === 1);
    await shot(pub, "01-home");

    await pub.goto(`${BASE}/signup`);
    ok("signup: full name field", await pub.getByText("Your full name", { exact: false }).count() > 0);
    ok("signup: residential address field", await pub.getByText("Residential address", { exact: false }).count() > 0);
    ok("signup: mobile field", await pub.getByText("Mobile number", { exact: false }).count() > 0);
    const chooserLinks = await pub.locator('a[href*="/signup/agency"], a[href*="/signup/renter"]').count();
    ok("signup: no account-type chooser links", chooserLinks === 0, `found ${chooserLinks}`);
    await shot(pub, "02-signup");

    await pub.goto(`${BASE}/terms`);
    await settled(pub);
    await pub.getByText("For owners", { exact: false }).first().click();
    await pub.waitForTimeout(400);
    ok("terms: owner tab shows Rental Page owner terms", (await pub.locator("body").innerText()).includes("Rental Page owner"));
    await pub.goto(`${BASE}/pricing`);
    const pricingText = await pub.locator("body").innerText();
    ok("pricing: listing free forever", /free forever|free to list|Listing is free/i.test(pricingText));
    ok("pricing: no 'free while we build' leak", !/free while we build|hand-?picked/i.test(pricingText));
    await pub.goto(`${BASE}/`);
    const footerText = await pub.locator("footer").innerText().catch(() => "");
    ok("footer: wear-vs-damage guide link", /wear/i.test(footerText));
    ok("footer: accident guide link", /accident/i.test(footerText));

    // ── owner: create page via UI ────────────────────────────────────
    section("owner UI: create Rental Page, dashboard shell");
    const ownerPg = await mk(await cookiesFor(`fe-owner-${STAMP}@phone.drivelink.invalid`));
    await ownerPg.goto(`${BASE}/account/pages/new`);
    await settled(ownerPg);
    ok("create-page form heading", (await ownerPg.locator("body").innerText()).includes("Create your Rental Page"));
    await ownerPg.getByText("Personal", { exact: true }).first().click();
    await ownerPg.getByPlaceholder(/Kasun/i).fill("FE Motors");
    // custom Select for city
    const nativeSelect = await ownerPg.locator("select").count();
    if (nativeSelect > 0) await ownerPg.locator("select").first().selectOption({ label: "Colombo" });
    else {
      await ownerPg.getByText("Pick a city", { exact: false }).first().click();
      await ownerPg.getByText("Colombo", { exact: true }).first().click();
    }
    await ownerPg.getByPlaceholder("0771234567").fill("0771234567");
    await ownerPg.getByRole("button", { name: /Create Rental Page/i }).click();
    await ownerPg.waitForURL("**/dashboard**", { timeout: 20000 });
    ok("create page -> dashboard", ownerPg.url().includes("/dashboard"));
    const { data: pageRow } = await svc.from("agencies").select("id, name, page_type, is_verified").eq("owner_id", ownerId).single();
    ok("page row created via UI", pageRow?.name === "FE Motors" && pageRow?.page_type === "personal" && pageRow?.is_verified === true, JSON.stringify(pageRow));
    const pageId = pageRow.id;
    await settled(ownerPg);
    const switcherVisible = await ownerPg.getByText("FE Motors").first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
    ok("PageSwitcher shows page name", switcherVisible);
    const settingsVisible = await ownerPg.getByText("Page settings").first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
    ok("sidebar has Page settings", settingsVisible);
    await shot(ownerPg, "03-dashboard");

    // wizard structure (not full submit — photos flow verified via API E2E)
    await ownerPg.goto(`${BASE}/dashboard/vehicles/new`);
    await settled(ownerPg);
    const wizText = await ownerPg.locator("body").innerText();
    ok("wizard renders", /photo|vehicle/i.test(wizText));
    await shot(ownerPg, "04-wizard");

    // seed vehicle server-side for the booking flows
    const { data: veh, error: vehErr } = await svc.from("vehicles").insert({
      agency_id: pageId, make: "Toyota", model: "Aqua", year: 2017, insurance_type: "hire",
      fuel_policy: "full_to_full", daily_rate_lkr: 9000, deposit_lkr: 20000, city: "Colombo",
      status: "available", self_drive: true, with_driver: false, vehicle_type: "car",
      fuel_type: "petrol", plate_number: `FE-${STAMP}`, slug: `fe-aqua-${STAMP}`,
      included_km_per_day: 100, extra_mileage_lkr: 30, has_gps_tracker: true,
      photos: [], seats: 5, transmission: "automatic",
    }).select("id, slug").single();
    ok("vehicle seeded", !vehErr, vehErr?.message);

    // ── renter: browse + terms panel + book via UI ───────────────────
    section("renter UI: vehicle page terms panel, booking request");
    const renterPg = await mk(await cookiesFor(`fe-renter-${STAMP}@phone.drivelink.invalid`));
    await renterPg.goto(`${BASE}/vehicles/${veh.slug}`);
    await settled(renterPg);
    const vText = await renterPg.locator("body").innerText();
    ok("vehicle page renders", vText.includes("Toyota") && vText.includes("Aqua"));
    ok("terms panel present", vText.includes("Rental terms"));
    ok("no-surprise-charges line", /No surprise charges/i.test(vText));
    ok("km allowance shown", /100 km\/day/i.test(vText));
    ok("GPS disclosure shown", /GPS tracker/i.test(vText));
    ok("driver requirement shown", /Driver 23\+|licence held/i.test(vText));
    await shot(renterPg, "05-vehicle-terms");

    // booking form: fill dates and submit
    const dateInputs = renterPg.locator('input[type="date"]');
    const nDates = await dateInputs.count();
    ok("booking form date inputs", nDates >= 2, `found ${nDates}`);
    await dateInputs.nth(0).fill(d(3));
    await dateInputs.nth(1).fill(d(5));
    await renterPg.getByRole("button", { name: /request/i }).first().click();
    // lands on booking page or shows success — resolve booking from DB
    const booking = await (async () => {
      for (let i = 0; i < 20; i++) {
        const { data } = await svc.from("bookings").select("id, status").eq("renter_id", renterId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) return data;
        await sleep(500);
      }
      return null;
    })();
    ok("booking created via UI", !!booking, "no booking row appeared");
    ok("status pending confirmation", booking?.status === "pending_confirmation", booking?.status);
    await renterPg.goto(`${BASE}/bookings/${booking.id}`);
    const bText = await renterPg.locator("body").innerText();
    ok("renter booking page shows waiting state", /Waiting for Confirmation/i.test(bText));
    await shot(renterPg, "06-booking-waiting");

    // ── owner: confirm via UI ────────────────────────────────────────
    section("owner UI: confirm booking, agreement signing");
    await ownerPg.goto(`${BASE}/dashboard/bookings`);
    await ownerPg.getByRole("button", { name: /^confirm$/i }).first().click();
    await sleep(2500);
    const { data: afterConfirm } = await svc.from("bookings").select("status").eq("id", booking.id).single();
    ok("confirm via UI -> active (free launch)", afterConfirm?.status === "active", afterConfirm?.status);

    // agreement: renter signs, then owner
    const agreementReady = await (async () => {
      for (let i = 0; i < 20; i++) {
        const { data } = await svc.from("booking_agreements").select("id").eq("booking_id", booking.id).maybeSingle();
        if (data) return true;
        await sleep(500);
      }
      return false;
    })();
    ok("agreement snapshot exists", agreementReady);
    await renterPg.goto(`${BASE}/bookings/${booking.id}/agreement`);
    await settled(renterPg);
    const agText = await renterPg.locator("body").innerText();
    ok("agreement: venue disclaimer", /not a party/i.test(agText));
    ok("agreement: police mode present", /Show to police/i.test(agText));
    ok("agreement: deposit standard", /deposit/i.test(agText));
    const renterAccept = renterPg.getByRole("button", { name: /accept agreement/i }).first();
    await renterAccept.waitFor({ state: "visible" });
    await renterAccept.click();
    let ag1 = await pollDb(async () => {
      const { data } = await svc.from("booking_agreements").select("renter_accepted_at").eq("booking_id", booking.id).single();
      return data?.renter_accepted_at ? data : null;
    });
    if (!ag1) { await renterAccept.click().catch(() => {}); ag1 = await pollDb(async () => {
      const { data } = await svc.from("booking_agreements").select("renter_accepted_at").eq("booking_id", booking.id).single();
      return data?.renter_accepted_at ? data : null;
    }); }
    ok("renter signed via UI", !!ag1);
    await shot(renterPg, "07-agreement");
    await ownerPg.goto(`${BASE}/bookings/${booking.id}/agreement`);
    await settled(ownerPg);
    await ownerPg.getByRole("button", { name: /accept agreement/i }).first().click();
    const ag2 = await pollDb(async () => {
      const { data } = await svc.from("booking_agreements").select("owner_accepted_at").eq("booking_id", booking.id).single();
      return data?.owner_accepted_at ? data : null;
    });
    ok("owner signed via UI", !!ag2);

    // ── messaging via UI ─────────────────────────────────────────────
    section("messaging UI");
    await renterPg.goto(`${BASE}/bookings/${booking.id}`);
    await settled(renterPg);
    const msgOpen = renterPg.getByRole("button", { name: /message/i }).first();
    if (await msgOpen.count()) await msgOpen.click().catch(() => {});
    const msgBox = renterPg.locator("textarea").last();
    await msgBox.waitFor({ state: "visible" });
    await msgBox.fill("Hello from the frontend E2E!");
    // send button is icon-only (no accessible name): use the chat form's button
    const sendBtn = renterPg.locator("form:has(textarea) button").last();
    if (await sendBtn.count()) await sendBtn.click();
    else await msgBox.press("Enter");
    const msgs = await pollDb(async () => {
      const { data } = await svc.from("booking_messages").select("body").eq("booking_id", booking.id);
      return (data ?? []).some((m) => m.body.includes("frontend E2E")) ? data : null;
    });
    ok("message sent via UI", !!msgs, "message row never appeared");

    // ── inspection via UI ────────────────────────────────────────────
    section("pickup inspection UI");
    await ownerPg.goto(`${BASE}/dashboard/bookings`);
    await ownerPg.getByRole("button", { name: /pickup inspection/i }).first().click();
    await sleep(500);
    // the "Add more" input takes multiple files in one shot (the per-slot
    // inputs get replaced by previews as they fill, so handles go stale)
    const addMore = ownerPg.locator('input[type="file"][multiple]').first();
    await addMore.setInputFiles(photoFiles(4));
    const uploaded = await ownerPg.waitForFunction(
      () => /4\/4/.test(document.body.innerText),
      null, { timeout: 30000 },
    ).then(() => true).catch(() => false);
    ok("4 photos uploaded via UI", uploaded, (await ownerPg.locator(".text-rose-600").allInnerTexts().catch(() => [])).join("; "));
    await ownerPg.getByPlaceholder("e.g. 45210").fill("45000");
    await ownerPg.getByRole("button", { name: /^full$/i }).first().click().catch(async () => {
      await ownerPg.getByText(/^Full$/).first().click();
    });
    // plate confirm + deposit received + documents present checkboxes
    for (const cb of await ownerPg.locator('input[type="checkbox"]').all()) {
      await cb.check().catch(() => {});
    }
    await sleep(300);
    const sel = ownerPg.locator("select");
    if (await sel.count()) await sel.first().selectOption({ index: 1 }).catch(() => {});
    await ownerPg.getByRole("button", { name: /submit pickup inspection/i }).click();
    await sleep(1500);
    const formError = (await ownerPg.locator(".text-rose-600").allInnerTexts().catch(() => [])).join("; ");
    if (formError) console.log(`  (form error shown: ${formError})`);
    const inspection = await (async () => {
      for (let i = 0; i < 20; i++) {
        const { data } = await svc.from("booking_inspections").select("id, phase, photo_urls").eq("booking_id", booking.id).eq("phase", "pickup").maybeSingle();
        if (data) return data;
        await sleep(600);
      }
      return null;
    })();
    ok("pickup inspection submitted via UI", !!inspection, "no inspection row");
    ok("inspection has 4 photos", (inspection?.photo_urls ?? []).length === 4, `${inspection?.photo_urls?.length}`);
    await shot(ownerPg, "08-after-inspection");

    // renter reviews
    await renterPg.goto(`${BASE}/bookings/${booking.id}`);
    await renterPg.getByRole("button", { name: /looks correct/i }).first().click();
    const acked = await pollDb(async () => {
      const { data } = await svc.from("booking_inspections").select("renter_ack_at").eq("booking_id", booking.id).eq("phase", "pickup").single();
      return data?.renter_ack_at ? data : null;
    });
    ok("renter acked inspection via UI", !!acked);
    await shot(renterPg, "09-inspection-acked");

    // ── dispute + admin resolution via UI ────────────────────────────
    section("dispute + admin resolution UI");
    await renterPg.goto(`${BASE}/bookings/${booking.id}`);
    await settled(renterPg);
    const reportBtn = renterPg.getByRole("button", { name: /report a problem/i }).first();
    await reportBtn.waitFor({ state: "visible", timeout: 20000 });
    await reportBtn.click();
    await sleep(400);
    await renterPg.locator("textarea").last().fill("The air conditioning failed on the expressway.");
    await renterPg.getByRole("button", { name: /submit|report/i }).last().click();
    const disputed = await pollDb(async () => {
      const { data } = await svc.from("bookings").select("status").eq("id", booking.id).single();
      return data?.status === "disputed" ? data : null;
    });
    ok("dispute filed via UI", !!disputed, "status never reached disputed");

    const adminPg = await mk(await cookiesFor(`fe-admin-${STAMP}@phone.drivelink.invalid`));
    adminPg.on("dialog", (dlg) => dlg.accept("Owner arranged a repair, renter compensated one day."));
    await adminPg.goto(`${BASE}/admin/bookings?status=disputed`);
    await settled(adminPg);
    const adminSees = await adminPg.getByText(/Aqua/).first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
    ok("admin sees disputed booking", adminSees, "booking not visible");
    await adminPg.getByRole("button", { name: /resolve/i }).first().click();
    await sleep(2500);
    const { data: resolved } = await svc.from("bookings").select("status").eq("id", booking.id).single();
    ok("admin resolved via UI (prompt dialog)", resolved?.status === "completed", resolved?.status);
    const { data: incRes } = await svc.from("incidents").select("status, resolution_note").eq("booking_id", booking.id);
    ok("incident closed with note", (incRes ?? []).every((i) => i.status === "resolved" && i.resolution_note), JSON.stringify(incRes));
    await shot(adminPg, "10-admin-resolved");

    // ── renter account structure ─────────────────────────────────────
    section("account structure");
    await renterPg.goto(`${BASE}/account`);
    const acctText = await renterPg.locator("body").innerText();
    ok("account: driving licence card", /Driving licence/i.test(acctText));
    ok("account: rental pages section", /Rental Page/i.test(acctText));
    ok("account: document sharing history", /Document sharing history/i.test(acctText));
    await shot(renterPg, "11-account");

    await browser.close();
  } catch (err) {
    fail++;
    failures.push(`UNCAUGHT: ${err.message}`);
    console.error("UNCAUGHT:", err.message);
    await browser.close().catch(() => {});
  }
}

async function cleanup() {
  section("cleanup");
  try {
    const userIds = created.users;
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
    if (smsBackup && Object.keys(smsBackup).length) await svc.from("platform_settings").update(smsBackup).eq("id", true);
    console.log(`  cleaned: ${userIds.length} users, ${bookingIds.length} bookings, ${pageIds.length} pages; toggles restored`);
  } catch (err) {
    console.error("  CLEANUP ERROR:", err.message);
  }
}

try { await main(); } finally {
  await cleanup();
  console.log(`\n===== FRONTEND E2E: ${pass} passed, ${fail} failed =====`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(fail > 0 ? 1 : 0);
}
