#!/usr/bin/env node
/*
 * A listing awaiting review must be visible to the people deciding on it and
 * to nobody else.
 *
 * The admin panel's "Open public preview" link went to a 404, because the page
 * read through the anonymous client and row-level security hides a pending
 * listing from the public. The page already had the "not live yet" banner for
 * this case; it simply never reached it.
 *
 * Widening a read is exactly the kind of fix that leaks something, so this
 * checks both directions: the two entitled viewers get in, and a stranger,
 * a signed-in outsider and the anonymous public still do not.
 *
 * It also covers the 404 page itself, which rendered with no header because it
 * sits outside the marketplace route group.
 *
 * Usage: node scripts/verify-pending-listing-preview.mjs   (needs a dev server)
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://localhost:3000";
const PASSWORD = "Preview-1!";
const stamp = Date.now().toString(36);

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let ok = true;
const chk = (l, c, x = "") => { if (!c) ok = false; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "   " + x : ""}`); };
const made = { users: [], agencies: [], vehicles: [] };
let browser;

async function makeUser(tag, patch = {}) {
  const email = `${tag}-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: tag, phone: `+9477${String(Date.now() + made.users.length).slice(-7)}` },
  });
  if (error) throw error;
  made.users.push(data.user.id);
  await service.from("profiles").update({ kyc_status: "verified", ...patch }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

const sessions = new Map();

async function cookiesFor(email, host) {
  const { data: sess, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  sessions.set(email, sess.session);
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: sess.session.access_token, refresh_token: sess.session.refresh_token });
  return [...jar.entries()].map(([name, value]) => ({ name, value, domain: host, path: "/" }));
}

try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);
  const host = new URL(BASE).hostname;

  const admin = await makeUser("prevadmin", { role: "admin" });
  const owner = await makeUser("prevowner");
  const stranger = await makeUser("prevstranger");

  const { data: agency, error: aErr } = await service.from("agencies").insert({
    owner_id: owner.id, name: `Preview Rentals ${stamp}`, slug: `preview-${stamp}`,
    city: "Colombo", whatsapp_number: "+94770000420", page_type: "personal",
    email: `preview-${stamp}@example.invalid`, is_verified: true,
    whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (aErr) throw aErr;
  made.agencies.push(agency.id);

  const slug = `preview-tuktuk-${stamp}`;
  const { data: vehicle, error: vErr } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Bajaj", model: "RE", year: 2023,
    vehicle_type: "tuktuk", transmission: "manual", seats: 4, fuel_type: "petrol",
    city: "Colombo", daily_rate_lkr: 500, slug, plate_number: `CB ${stamp.slice(-4)}`,
    insurance_type: "hire", status: "pending_review",
  }).select("id").single();
  if (vErr) throw vErr;
  made.vehicles.push(vehicle.id);
  console.log(`seeded a pending_review listing at /vehicles/${slug}\n`);

  browser = await chromium.launch();
  const visit = async (label, cookies) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (cookies) await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    const res = await page.goto(`${BASE}/vehicles/${slug}`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const body = await page.evaluate(() => document.body.innerText);
    await ctx.close();
    return { status: res?.status() ?? 0, is404: /Looks like you|404/i.test(body), body };
  };

  const asAnon = await visit("anonymous", null);
  chk("anonymous still cannot see a pending listing", asAnon.is404, `status ${asAnon.status}`);

  const asStranger = await visit("stranger", await cookiesFor(stranger.email, host));
  chk("a signed-in outsider still cannot see it", asStranger.is404, `status ${asStranger.status}`);

  const asOwner = await visit("owner", await cookiesFor(owner.email, host));
  chk("the owner can preview their own pending listing", !asOwner.is404, `status ${asOwner.status}`);

  const asAdmin = await visit("admin", await cookiesFor(admin.email, host));
  chk("an admin can preview it", !asAdmin.is404, `status ${asAdmin.status}`);
  chk("the preview says it is not live yet",
    /pending|review|not live|will appear/i.test(asAdmin.body));

  // ── The thumb bar ──
  // It is a phone affordance duplicating the request card, so it must not
  // appear on desktop, and must never offer dates on a listing that is not
  // taking bookings. It rendered as a stray card under Guest reviews because
  // md:static unsticks an element without removing it.
  const { data: liveVehicle, error: lvErr } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: "Aqua", year: 2019,
    vehicle_type: "car", transmission: "automatic", seats: 5, fuel_type: "petrol",
    city: "Colombo", daily_rate_lkr: 7500, deposit_lkr: 20000,
    slug: `preview-live-${stamp}`, plate_number: `CA ${stamp.slice(-4)}`,
    insurance_type: "hire", self_drive: true,
    // Publication is guarded in the database: a live listing needs photos and
    // a current right-to-list declaration, so the seed has to satisfy both.
    photos: [1, 2, 3, 4].map((n) => `https://example.invalid/preview-${stamp}-${n}.jpg`),
    status: "pending_review",
  }).select("id").single();
  if (lvErr) throw lvErr;
  made.vehicles.push(liveVehicle.id);

  const ownerSession = sessions.get(owner.email);
  const asOwnerDb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${ownerSession.access_token}` } },
  });
  const { error: declErr } = await asOwnerDb.from("vehicles")
    .update({ listing_authority_declared: true, listing_authority_basis: "registered_owner" })
    .eq("id", liveVehicle.id);
  if (declErr) throw new Error("right-to-list declaration failed: " + declErr.message);

  const { error: pubErr } = await service.from("vehicles")
    .update({ status: "available" }).eq("id", liveVehicle.id);
  if (pubErr) throw new Error("publish failed: " + pubErr.message);

  const barState = async (path, width) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 700, hasTouch: width < 700 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((x) => x.textContent.trim() === "Choose dates");
      if (!a) return { present: false, visible: false };
      const bar = a.closest("div")?.parentElement;
      const cs = bar ? getComputedStyle(bar) : null;
      return { present: true, visible: !!(a.offsetWidth || a.offsetHeight), position: cs?.position ?? "?" };
    });
    await ctx.close();
    return r;
  };

  const liveMobile = await barState(`/vehicles/preview-live-${stamp}`, 390);
  chk("on a phone, a live listing still gets the thumb bar", liveMobile.visible, JSON.stringify(liveMobile));
  chk("and it is still sticky there", liveMobile.position === "sticky", liveMobile.position ?? "-");

  const liveDesktop = await barState(`/vehicles/preview-live-${stamp}`, 1440);
  chk("on desktop it is gone, not floating below the reviews", !liveDesktop.visible, JSON.stringify(liveDesktop));

  const pendingMobile = await barState(`/vehicles/${slug}`, 390);
  chk("a listing not taking bookings never offers dates", !pendingMobile.present, JSON.stringify(pendingMobile));

  // The 404 page itself.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/this-page-does-not-exist-${stamp}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const chrome = await page.evaluate(() => ({
    header: document.querySelectorAll("header").length,
    footer: document.querySelectorAll("footer").length,
    hasBrowseLink: !!document.querySelector('a[href="/vehicles"]'),
  }));
  console.log(`\n404 page chrome: ${JSON.stringify(chrome)}`);
  chk("the 404 page has the site header", chrome.header >= 1);
  chk("the 404 page has the site footer", chrome.footer >= 1);
  await ctx.close();
} catch (e) {
  ok = false;
  console.error("\nRUN FAILED:", e.message);
} finally {
  if (browser) await browser.close();
  for (const id of made.vehicles) await service.from("vehicles").delete().eq("id", id);
  for (const id of made.agencies) await service.from("agencies").delete().eq("id", id);
  for (const id of made.users) await service.auth.admin.deleteUser(id);
  console.log("\ncleaned up");
}

console.log(ok ? "\nPENDING PREVIEW: visible to the right people, hidden from everyone else." : "\nPENDING PREVIEW: FAILED");
process.exit(ok ? 0 : 1);
