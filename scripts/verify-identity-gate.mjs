#!/usr/bin/env node
/*
 * One identity check, then the account. No separate licence review.
 *
 * The gate: a signed-in account cannot use DriveLink until the identity check
 * (passport, NIC or driving licence) has passed. Browsing stays open, and so do
 * settings and support, so nobody stuck in review is locked away from help or
 * from deleting their account.
 *
 * The licence: DriveLink no longer reviews it. The owner inspects the original
 * at handover. The only self-drive rule left is age, read from the verified
 * identity document, and a missing birth date must not refuse a verified
 * renter.
 *
 * Usage: node scripts/verify-identity-gate.mjs   (needs a dev server)
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://localhost:3000";
const PASSWORD = "Gatecheck-1!";
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
let n = 0;

async function makeUser(tag, patch) {
  const email = `gate-${tag}-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `Gate ${tag}`, phone: `+9477${String(Date.now() + ++n * 7).slice(-7)}` },
  });
  if (error) throw error;
  made.users.push(data.user.id);
  const { error: upErr } = await service.from("profiles").update(patch).eq("id", data.user.id);
  if (upErr) throw upErr;
  return { id: data.user.id, email };
}

async function sessionFor(email) {
  const { data: sess, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: sess.session.access_token, refresh_token: sess.session.refresh_token });
  const host = new URL(BASE).hostname;
  return {
    token: sess.session.access_token,
    cookies: [...jar.entries()].map(([name, value]) => ({ name, value, domain: host, path: "/" })),
    header: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

async function landsOn(session, path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (session) await ctx.addCookies(session.cookies);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  const url = new URL(page.url());
  const text = await page.evaluate(() => document.body.innerText);
  await ctx.close();
  return { path: url.pathname, search: url.search, text };
}

function isoDay(offset) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);

  const unverified = await makeUser("unverified", { kyc_status: "unverified" });
  const pending = await makeUser("pending", { kyc_status: "pending" });
  const adult = await makeUser("adult", { kyc_status: "verified", date_of_birth: "1990-05-01" });
  const young = await makeUser("young", { kyc_status: "verified", date_of_birth: isoDay(-20 * 365) });
  const noDob = await makeUser("nodob", { kyc_status: "verified", date_of_birth: null });
  const admin = await makeUser("admin", { kyc_status: "unverified", role: "admin" });
  const owner = await makeUser("owner", { kyc_status: "verified" });

  browser = await chromium.launch();

  // ── The gate ──
  const sUnverified = await sessionFor(unverified.email);
  const a = await landsOn(sUnverified, "/account");
  chk("unverified: /account sends to the identity check", a.path === "/verify-identity", a.path + a.search);
  chk("unverified: and remembers where they were heading", decodeURIComponent(a.search).includes("next=/account"));
  chk("unverified: the check offers passport, NIC or licence",
    /Passport/.test(a.text) && /NIC/.test(a.text) && /Driving licence/.test(a.text));
  chk("unverified: it offers to start verification", /Verify my identity/.test(a.text));

  const b = await landsOn(sUnverified, "/bookings");
  chk("unverified: /bookings is held too", b.path === "/verify-identity", b.path);

  const c = await landsOn(sUnverified, "/account/settings");
  chk("unverified: settings stays reachable (sign out, delete account)", c.path === "/account/settings", c.path);

  const d = await landsOn(sUnverified, "/account/support");
  chk("unverified: support stays reachable", d.path === "/account/support", d.path);

  const e = await landsOn(sUnverified, "/vehicles");
  chk("unverified: browsing vehicles stays open", e.path === "/vehicles", e.path);

  const sPending = await sessionFor(pending.email);
  const p = await landsOn(sPending, "/verify-identity");
  chk("pending: can start again, in case they closed Didit part way",
    /Start verification again/.test(p.text) && /being reviewed/i.test(p.text));

  const sAdult = await sessionFor(adult.email);
  const f = await landsOn(sAdult, "/account");
  chk("verified: /account opens normally", f.path === "/account", f.path);
  chk("verified: no separate driving licence card on the account", !/Driving licence/i.test(f.text));
  const g = await landsOn(sAdult, "/verify-identity?next=/bookings");
  chk("verified: the identity page sends them straight on", g.path === "/bookings", g.path);

  const sAdmin = await sessionFor(admin.email);
  const h = await landsOn(sAdmin, "/verify-identity");
  chk("admin: never held at the identity check", h.path === "/admin", h.path);

  // ── Self-drive without any licence review ──
  const sOwner = await sessionFor(owner.email);
  const { data: agency, error: aErr } = await service.from("agencies").insert({
    owner_id: owner.id, name: `Gate Rentals ${stamp}`, slug: `gate-${stamp}`,
    city: "Colombo", whatsapp_number: "+94770000520", page_type: "personal",
    email: `gate-${stamp}@example.invalid`, is_verified: true,
    whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (aErr) throw aErr;
  made.agencies.push(agency.id);

  const { data: vehicle, error: vErr } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: "Aqua", year: 2019,
    vehicle_type: "car", transmission: "automatic", seats: 5, fuel_type: "petrol",
    city: "Colombo", daily_rate_lkr: 7500, slug: `gate-aqua-${stamp}`,
    plate_number: `CAG ${stamp.slice(-4)}`, insurance_type: "hire",
    self_drive: true, with_driver: false, min_renter_age: 23, min_license_years: 2,
    photos: [1, 2, 3, 4].map((i) => `https://example.invalid/gate-${stamp}-${i}.jpg`),
    status: "pending_review",
  }).select("id").single();
  if (vErr) throw vErr;
  made.vehicles.push(vehicle.id);

  const ownerDb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sOwner.token}` } },
  });
  const { error: declErr } = await ownerDb.from("vehicles")
    .update({ listing_authority_declared: true, listing_authority_basis: "registered_owner" })
    .eq("id", vehicle.id);
  if (declErr) throw new Error("right-to-list declaration failed: " + declErr.message);
  const { error: pubErr } = await service.from("vehicles").update({ status: "available" }).eq("id", vehicle.id);
  if (pubErr) throw new Error("publish failed: " + pubErr.message);

  const request = async (session, days) => {
    const res = await fetch(`${BASE}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: session.header, Origin: BASE },
      body: JSON.stringify({
        vehicle_id: vehicle.id, start_date: isoDay(days), end_date: isoDay(days + 2),
        start_time: "10:00", end_time: "10:00", rental_mode: "self_drive",
      }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  const r1 = await request(sAdult, 4);
  chk("self-drive: a verified adult with no licence on file can request", r1.status === 200 || r1.status === 201,
    `${r1.status} ${r1.body.error ?? ""}`);

  const r2 = await request(await sessionFor(young.email), 8);
  chk("self-drive: age from the verified ID is still enforced", r2.status === 403 && r2.body.eligibilityCode === "minimum_age",
    `${r2.status} ${r2.body.eligibilityCode ?? r2.body.error ?? ""}`);

  const r3 = await request(await sessionFor(noDob.email), 12);
  chk("self-drive: a missing birth date does not refuse a verified renter", r3.status === 200 || r3.status === 201,
    `${r3.status} ${r3.body.error ?? ""}`);

  chk("self-drive: no response asks for a licence review",
    ![r1, r2, r3].some((r) => "needsLicenceReview" in (r.body ?? {})));
} catch (err) {
  ok = false;
  console.error("\nRUN FAILED:", err.message);
} finally {
  if (browser) await browser.close();
  for (const id of made.vehicles) {
    await service.from("bookings").delete().eq("vehicle_id", id);
    await service.from("vehicles").delete().eq("id", id);
  }
  for (const id of made.agencies) await service.from("agencies").delete().eq("id", id);
  for (const id of made.users) {
    await service.from("activity_events").delete().eq("actor_id", id);
    await service.auth.admin.deleteUser(id);
  }
  console.log("\ncleaned up");
}

console.log(ok ? "\nIDENTITY GATE: one check, then the app; no licence review." : "\nIDENTITY GATE: FAILED");
process.exit(ok ? 0 : 1);
