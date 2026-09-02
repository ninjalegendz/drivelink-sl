#!/usr/bin/env node
/*
 * Measures how long a signed-in owner stares at an unchanged screen after
 * tapping a link, on a slow mobile connection.
 *
 * This exists because "nothing happens when I tap" is easy to assert and easy
 * to get wrong: a forced synthetic click that lands on an overlay navigates
 * nowhere and looks identical to a frozen app. The click here is dispatched on
 * the anchor itself, and the probe records the first DOM mutation of any kind,
 * so it cannot miss a spinner, a skeleton, or a route swap.
 *
 * Signed-in dashboard routes are the interesting case: they are auth-gated, so
 * Next never prefetches them, and each one does several database round trips.
 *
 * Usage: node scripts/measure-nav-feedback.mjs   (needs a dev/prod server on 3000)
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Navfeedback-1!";
const stamp = Date.now().toString(36);

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);

const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const created = { userIds: [], agencyIds: [] };

async function makeOwner() {
  const email = `navfeedback-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: "Nav Feedback", phone: `+9471${String(Date.now()).slice(-7)}` },
  });
  if (error) throw error;
  created.userIds.push(data.user.id);
  await service.from("profiles").update({ kyc_status: "verified" }).eq("id", data.user.id);

  const { data: agency, error: agencyError } = await service.from("agencies").insert({
    owner_id: data.user.id, name: `Nav Feedback ${stamp}`, slug: `nav-feedback-${stamp}`,
    city: "Colombo", whatsapp_number: "+94770000000", page_type: "personal", email,
  }).select("id").single();
  if (agencyError) throw agencyError;
  created.agencyIds.push(agency.id);
  return { email, agencyId: agency.id };
}

async function cookiesFor(email, agencyId) {
  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;

  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });

  const target = new URL(BASE);
  const base = { domain: target.hostname, path: "/", secure: target.protocol === "https:" };
  const jarCookies = [...jar.entries()].map(([name, value]) => ({ name, value, ...base }));
  return [...jarCookies, { name: "dl_active_page", value: agencyId, ...base }];
}

const HOPS = [
  ["/dashboard", "/dashboard/vehicles", "dashboard -> fleet"],
  ["/dashboard/vehicles", "/dashboard/vehicles/new", "fleet -> add vehicle"],
  ["/dashboard", "/dashboard/bookings", "dashboard -> bookings"],
  ["/account", "/account/documents", "account -> documents"],
];

let browser;
try {
  const owner = await makeOwner();
  const cookies = await cookiesFor(owner.email, owner.agencyId);
  browser = await chromium.launch();

  console.log(`\n${BASE}  signed-in owner, 300ms latency / 700kbps / 4x CPU\n`);
  console.log("hop".padEnd(28), "first pixel change".padEnd(20), "route committed");

  for (const [from, to, label] of HOPS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 300, downloadThroughput: (700 * 1024) / 8, uploadThroughput: (300 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    await page.goto(`${BASE}${from}`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      window.__probe = { start: 0, firstChange: null };
      new MutationObserver(() => {
        if (window.__probe.start && window.__probe.firstChange === null) {
          window.__probe.firstChange = performance.now();
        }
      }).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    });

    const link = page.locator(`a[href="${to}"]`).first();
    if (await link.count() === 0) { console.log(label.padEnd(28), "(no link found)"); await ctx.close(); continue; }

    await page.evaluate(() => { window.__probe.start = performance.now(); });
    await link.dispatchEvent("click");
    await page.waitForURL(`**${to}`, { timeout: 30000 }).catch(() => {});
    const committed = await page.evaluate(() => performance.now());
    await page.waitForTimeout(300);

    const probe = await page.evaluate(() => window.__probe);
    const rel = (v) => (v === null ? "NEVER" : `${Math.round(v - probe.start)}ms`);
    console.log(label.padEnd(28), rel(probe.firstChange).padEnd(20), rel(committed));
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  for (const id of created.agencyIds) await service.from("agencies").delete().eq("id", id);
  for (const id of created.userIds) await service.auth.admin.deleteUser(id);
  console.log(`\ncleaned up: ${created.userIds.length} user(s), ${created.agencyIds.length} page(s)`);
}
