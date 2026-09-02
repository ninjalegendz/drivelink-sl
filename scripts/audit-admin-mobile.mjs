#!/usr/bin/env node
/*
 * Every admin screen, on a phone.
 *
 * The admin area was built desktop-first and skipped in the mobile revamp, and
 * the public overflow sweep never reached it because it sits behind an admin
 * login. So a card whose action column could not shrink simply ran across the
 * name beside it, and nothing caught it.
 *
 * Reports two things per route: whether the page scrolls sideways, and any
 * element whose right edge lands outside the viewport - which is what
 * overlapping controls look like from the outside.
 *
 * Usage: node scripts/audit-admin-mobile.mjs   (needs a server on 3000)
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://localhost:3000";
const PASSWORD = "Adminaudit-1!";
const stamp = Date.now().toString(36);
const WIDTH = Number(process.env.WIDTH || 390);

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const ROUTES = [
  "/admin", "/admin/users", "/admin/vehicles", "/admin/agencies", "/admin/bookings",
  "/admin/blacklist", "/admin/reports", "/admin/inbox", "/admin/support",
  "/admin/slips", "/admin/invoices", "/admin/analytics",
  "/admin/settings", "/admin/settings/email", "/admin/settings/notifications", "/admin/settings/payments",
];

const created = { userIds: [] };
let problems = 0;
let browser;

try {
  const email = `adminaudit-${stamp}@phone.drivelink.invalid`;
  const { data: admin, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: "Admin Audit", phone: `+9470${String(Date.now()).slice(-7)}` },
  });
  if (error) throw error;
  created.userIds.push(admin.user.id);
  await service.from("profiles").update({ role: "admin", kyc_status: "verified" }).eq("id", admin.user.id);

  const { data: sess, error: signInError } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: sess.session.access_token, refresh_token: sess.session.refresh_token });
  const target = new URL(BASE);
  const cookies = [...jar.entries()].map(([name, value]) => ({
    name, value, domain: target.hostname, path: "/", secure: target.protocol === "https:",
  }));

  // Seed renters in the states that actually render the busy card: a pending
  // KYC with a Didit session (Sync / Approve / Reject), a verified one, and an
  // unverified one. An empty list proves nothing about a crowded card.
  for (const [n, kyc, session] of [
    ["Pending Renter", "pending", `didit-${stamp}`],
    ["Verified Renter", "verified", null],
    ["Unverified Renter", "unverified", null],
  ]) {
    const { data: r } = await service.auth.admin.createUser({
      email: `auditrenter-${n.split(" ")[0].toLowerCase()}-${stamp}@phone.drivelink.invalid`,
      password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: `${n} With A Fairly Long Name`, phone: `+9471${String(Date.now() + Math.random() * 1000 | 0).slice(-7)}` },
    });
    created.userIds.push(r.user.id);
    await service.from("profiles").update({
      kyc_status: kyc, didit_session_id: session, phone_verified: true, reliability_pct: 92,
    }).eq("id", r.user.id);
  }

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  console.log(`\n${BASE} as admin, ${WIDTH}px viewport\n`);
  console.log("route".padEnd(34), "scroll".padEnd(9), "spilling elements");

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(1400);

    const result = await page.evaluate(() => {
      const vw = window.innerWidth;
      const spills = [];
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Only the element itself, not a parent that merely contains one.
        if (r.right > vw + 1 && !spills.some((s) => s.el.contains(el))) {
          spills.push({ el, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 46), right: Math.round(r.right) });
        }
      }
      return {
        scroll: document.documentElement.scrollWidth,
        vw,
        spills: spills.slice(0, 3).map((s) => `${s.tag}.${s.cls} → ${s.right}px`),
      };
    });

    const scrolls = result.scroll > result.vw + 1;
    if (scrolls || result.spills.length) problems += 1;
    console.log(
      route.padEnd(34),
      (scrolls ? `${result.scroll}px` : "ok").padEnd(9),
      result.spills.length ? result.spills[0] : "none",
    );
    for (const extra of result.spills.slice(1)) console.log(" ".repeat(44) + extra);
  }
} finally {
  if (browser) await browser.close();
  for (const id of created.userIds) await service.auth.admin.deleteUser(id);
  console.log(`\ncleaned up: ${created.userIds.length} admin account`);
}

if (problems) {
  console.log(`\nADMIN MOBILE: ${problems} route(s) need attention.`);
  process.exit(1);
}
console.log("\nADMIN MOBILE: every route fits the screen.");
