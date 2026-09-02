// Frontend (browser) E2E walkthrough of the Rental Pages rebuild.
//
// Playwright + Chromium against the local dev server: real clicks through
// the real UI, with structural assertions that the shipped screens match
// the blueprint (universal signup, Rental Pages, Terms Engine panel,
// messaging, the owner closing the rental, and reviews
// resolution). DB assertions via the service client where the UI's
// side-effects land. Self-cleaning, SMS toggles muted around the run.
//
// Run: node scripts/e2e-frontend.mjs   (dev server up with messaging
//      env neutralized, same as e2e-walkthrough.mjs)
import { chromium } from "playwright";
import { createClient as createSb } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import fs from "fs";

// localhost, because the R2 buckets' CORS allowlist contains that exact origin
// and browser photo uploads fail preflight from any other. See assertServingDriveLink
// below for the hazard that comes with it.
const BASE = process.env.DRIVELINK_TEST_BASE || "http://localhost:3000";

/**
 * On Windows `localhost` resolves to ::1 before 127.0.0.1, so any other project
 * holding [::1]:3000 answers instead of this app. That does not look like a
 * misconfiguration when it happens: the suite reports that the signup page has
 * lost its fields and that buttons have stopped existing. Checking once, up
 * front, turns half an hour of chasing a phantom regression into one line.
 */
async function assertServingDriveLink() {
  let body = "";
  try {
    body = await (await fetch(`${BASE}/login`)).text();
  } catch (err) {
    throw new Error(`Nothing is answering on ${BASE}. Start the app first.`, { cause: err });
  }
  if (!/DriveLink/i.test(body)) {
    throw new Error(
      `${BASE} is serving a different application, so this run would test the wrong app.
`
      + `        On Windows, localhost resolves to ::1 first: another project's dev server is probably on that port.
`
      + `        Stop it, or run against the other address with DRIVELINK_TEST_BASE.`,
    );
  }
}
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
  // Derived from BASE, not hardcoded: a cookie scoped to "localhost" is simply
  // not sent to 127.0.0.1, which presents as every signed-in page redirecting
  // to login rather than as an auth error.
  const host = new URL(BASE).hostname;
  return [...jar.entries()].map(([name, value]) => ({ name, value, domain: host, path: "/" }));
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
  await assertServingDriveLink();
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
  // Self-drive now requires a licence DriveLink has actually reviewed, not
  // just two uploaded images. Seeding only the images left this renter blocked
  // at the request step, so the booking flow below could never run.
  await svc.from("profiles").update({
    kyc_status: "verified", nic_number: `199${STAMP}V`, address: "1 Test Lane, Colombo",
    license_front_url: `/api/docs/kyc/${renterId}/fe-lic-f.png`, license_back_url: `/api/docs/kyc/${renterId}/fe-lic-b.png`,
    license_review_status: "verified",
    license_reviewed_at: new Date().toISOString(),
    license_jurisdiction: "sri_lanka",
    date_of_birth: "1995-04-12",
    license_issued_on: "2018-06-01",
    license_expires_on: "2030-06-01",
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
    const createPageText = await ownerPg.locator("body").innerText();
    if (!createPageText.includes("Create your Rental Page")) {
      console.log("  [debug] /account/pages/new shows: " + JSON.stringify(createPageText.slice(0, 400)));
    }
    ok("create-page form heading", createPageText.includes("Create your Rental Page"));
    await ownerPg.getByText("Personal", { exact: true }).first().click();
    await ownerPg.getByPlaceholder(/Kasun/i).fill("FE Motors");
    // custom Select for city
    const nativeSelect = await ownerPg.locator("select").count();
    if (nativeSelect > 0) await ownerPg.locator("select").first().selectOption({ label: "Colombo" });
    else {
      await ownerPg.getByText("Pick a city", { exact: false }).first().click();
      await ownerPg.getByText("Colombo", { exact: true }).first().click();
    }
    // The phone field validates the NATIONAL number for the selected country:
    // Sri Lankan mobiles are 9 digits starting with 7, and the placeholder
    // shows that format. The old "0771234567" matched neither the placeholder
    // nor the validation rule, so this step could never find the field.
    await ownerPg.getByPlaceholder("771234567").fill("771234567");
    // The form now requires a contact email (statements, booking records and
    // signed agreements go there). Without it the submit never navigates.
    await ownerPg.getByPlaceholder("you@example.com").fill(`fe-owner-${STAMP}@example.com`);
    await ownerPg.getByRole("button", { name: /Create Rental Page/i }).click();
    await ownerPg.waitForURL("**/dashboard**", { timeout: 20000 });
    ok("create page -> dashboard", ownerPg.url().includes("/dashboard"));
    const { data: pageRow } = await svc.from("agencies").select("id, name, page_type, is_verified").eq("owner_id", ownerId).single();
    ok("page row created via UI", pageRow?.name === "FE Motors" && pageRow?.page_type === "personal" && pageRow?.is_verified === true, JSON.stringify(pageRow));
    const pageId = pageRow.id;
    await svc.from("agencies").update({ whatsapp_verified_at: new Date().toISOString() }).eq("id", pageId);
    await settled(ownerPg);
    const switcherVisible = await ownerPg.getByText("FE Motors").first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
    ok("PageSwitcher shows page name", switcherVisible);
    const settingsVisible = await ownerPg.getByText("Page settings").first().waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
    ok("sidebar has Page settings", settingsVisible);
    await shot(ownerPg, "03-dashboard");

    // wizard structure (not full submit - photos flow verified via API E2E)
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
      photos: Array(4).fill("/logo-horizontal.png"), seats: 5, transmission: "automatic",
      listing_authority_basis: "registered_owner", listing_authority_declared: true,
      listing_authority_confirmed_at: new Date().toISOString(), listing_authority_confirmed_by: ownerId,
      listing_authority_declaration_version: "vehicle-authority-v1",
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

    // Booking form: the date fields are the custom <DatePicker>, not native
    // date inputs, so drive them the way a person does. Each trigger carries
    // data-datepicker with its label and each day cell a data-date, so this
    // stays stable without depending on the rendered month name.
    // The calendar opens on the month of its minimum date, so a target in a
    // later month needs the same "next month" taps a person would make. This
    // used to click the day cell directly, which passed all month and then
    // failed for the few days a year when today + 3 crosses into the next one.
    const pickDate = async (label, iso) => {
      await renterPg.locator(`[data-datepicker="${label}"]`).click();
      const cell = renterPg.locator(`[data-date="${iso}"]`);
      for (let hop = 0; hop < 3 && await cell.count() === 0; hop += 1) {
        await renterPg.getByRole("button", { name: "Next month" }).click();
        await renterPg.waitForTimeout(150);
      }
      await cell.click();
    };
    const dateTriggers = renterPg.locator("[data-datepicker]");
    ok("booking form date pickers", await dateTriggers.count() >= 2, `found ${await dateTriggers.count()}`);
    await pickDate("Pick-up date", d(3));
    await pickDate("Return date", d(5));
    ok("pick-up date selected", await renterPg.locator('[data-datepicker="Pick-up date"]').getAttribute("data-value") === d(3));
    ok("return date selected", await renterPg.locator('[data-datepicker="Return date"]').getAttribute("data-value") === d(5));
    const reqBtns = await renterPg.getByRole("button", { name: /request/i }).allInnerTexts();
    await renterPg.getByRole("button", { name: /request/i }).first().click();
    await renterPg.waitForTimeout(3000);
    await settled(renterPg);
    const after = await renterPg.locator("body").innerText();
    // lands on booking page or shows success - resolve booking from DB
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
    await settled(renterPg);
    const bText = await renterPg.locator("body").innerText();
    ok("renter booking page shows waiting state", /Waiting for Confirmation/i.test(bText));
    await shot(renterPg, "06-booking-waiting");

    // ── owner: confirm via UI ────────────────────────────────────────
    section("owner UI: confirm booking");
    await ownerPg.goto(`${BASE}/dashboard/bookings`);
    await settled(ownerPg);
    await ownerPg.getByRole("button", { name: /^confirm$/i }).first().click();
    // "confirmed" means the owner accepted the dates. Everything after that
    // happens between the two people; the platform hears about it again only
    // when the owner marks the rental finished.
    const afterConfirm = await pollDb(async () => {
      const { data } = await svc.from("bookings").select("status").eq("id", booking.id).single();
      return data?.status === "confirmed" ? data : null;
    });
    ok("confirm via UI -> confirmed (reserved)", afterConfirm?.status === "confirmed", afterConfirm?.status ?? "not confirmed");

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

    // ── the owner closes the rental ──────────────────────────────────
    // DriveLink is not part of the handover any more, so there is no pickup
    // checklist, no start-rental gate and no dispute desk. The only thing left
    // for the platform to learn is that the rental finished, which is what
    // opens reviews and updates reliability.
    section("owner closes the rental");
    await ownerPg.goto(`${BASE}/dashboard/bookings`);
    await settled(ownerPg);
    await ownerPg.getByRole("button", { name: /rental finished/i }).first().click();
    const closed = await pollDb(async () => {
      const { data } = await svc.from("bookings").select("status").eq("id", booking.id).single();
      return data?.status === "completed" ? data : null;
    });
    ok("owner closes the rental via UI -> completed", !!closed, closed?.status ?? "never completed");

    await renterPg.goto(`${BASE}/bookings/${booking.id}`);
    await settled(renterPg);
    const renterText = await renterPg.locator("body").innerText();
    ok("renter sees the rental is finished", /finished|completed/i.test(renterText));
    ok("renter is invited to review", /how did it go|rating/i.test(renterText));
    ok("renter page states DriveLink's role", /introduces renters and vehicle owners/i.test(renterText));
    ok("no agreement or inspection language remains", !/rental agreement|pickup inspection|dispute/i.test(renterText));

    section("account structure");
    await renterPg.goto(`${BASE}/account`);
    await settled(renterPg);
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
    for (const table of ["document_access_log", "booking_messages", "blacklist_reports", "reviews"]) {
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

// The finally block exits the process, which swallowed anything main() threw:
// a crash during setup printed "0 passed, 0 failed" and exited 0, so a run that
// never happened looked like a clean one.
try {
  await main();
} catch (err) {
  fail += 1;
  failures.push(`ABORTED before the suite could run: ${err.message}`);
  console.error(`
ABORTED: ${err.message}`);
} finally {
  await cleanup();
  console.log(`\n===== FRONTEND E2E: ${pass} passed, ${fail} failed =====`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(fail > 0 ? 1 : 0);
}
