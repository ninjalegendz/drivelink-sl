#!/usr/bin/env node
/*
 * Every admin screen has to work on a phone.
 *
 * The admin panel gets run from a phone as often as a laptop, and several
 * screens were built as desktop rows: a text column beside a cluster of action
 * buttons that refused to shrink. On a 390px screen that cluster pushed past
 * the edge, so the page scrolled sideways and the buttons sat on the text.
 *
 * This opens every admin route at three phone widths, twice over with
 * the text scaled up the way phone browsers allow, and fails on:
 *   - the page scrolling sideways
 *   - any element reaching past the right edge
 *   - two controls overlapping each other
 * Controls too small to tap are reported as a note, not a failure.
 *
 * Usage: node scripts/verify-admin-mobile.mjs   (needs a dev server)
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Adminmobile-1!";
const stamp = Date.now().toString(36);
// 390 is a current iPhone, 375 an iPhone SE or mini, 320 the narrowest phone
// still in use and the width where a desktop row gives up first.
const PASSES = [
  { width: 390, text: 100 },
  { width: 375, text: 100 },
  { width: 320, text: 100 },
  // Bigger text is a setting people really use, and the bug report came
  // from a phone using it: the row could not shrink, so it overflowed.
  { width: 390, text: 130 },
  { width: 360, text: 130 },
];
const NEWLINE = String.fromCharCode(10);

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let ok = true;
const made = { users: [] };

async function adminSession() {
  const email = `admin-mobile-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Mobile Admin" },
  });
  if (error) throw error;
  made.users.push(data.user.id);
  await service.from("profiles").update({ role: "admin", kyc_status: "verified" }).eq("id", data.user.id);

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
  const host = new URL(BASE).hostname;
  return [...jar.entries()].map(([name, value]) => ({ name, value, domain: host, path: "/" }));
}

// What the page looks like to a thumb. This function runs inside the browser.
function auditInPage(screenWidth) {
  const vw = screenWidth;
  const laidOutWidth = window.innerWidth;
  const describe = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const text = (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 36);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const insideScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === "auto" || ps.overflowX === "scroll") return true;
    }
    return false;
  };
  // The bottom bar and other pinned overlays float over the page on purpose.
  const pinned = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.position === "fixed" || ps.position === "sticky") return true;
    }
    return false;
  };

  const scrolls = document.documentElement.scrollWidth > vw + 1;
  // A phone shrinks the whole page to fit overflowing content: text ends up
  // tiny or huge and columns collapse. That is the bug people actually see.
  const widened = laidOutWidth > vw + 1;

  const overflowing = [...document.querySelectorAll("body *")]
    .filter((el) => {
      if (!visible(el)) return false;
      if (pinned(el)) return false;
      if (insideScroller(el)) return false;
      const r = el.getBoundingClientRect();
      return r.right > vw + 1 || r.left < -1;
    })
    .slice(0, 4).map(describe);

  // Controls sitting on top of each other: the symptom in the bug report.
  const controls = [...document.querySelectorAll("a, button, input, select, textarea")]
    .filter((el) => visible(el) && !pinned(el));
  const overlaps = [];
  for (let i = 0; i < controls.length && overlaps.length < 4; i += 1) {
    for (let j = i + 1; j < controls.length && overlaps.length < 4; j += 1) {
      const a = controls[i], b = controls[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 4 && h > 4) overlaps.push(`${describe(a)} over ${describe(b)}`);
    }
  }

  const small = controls
    .filter((el) => {
      if (el.tagName !== "BUTTON" && el.tagName !== "A") return false;
      if (!(el.innerText || "").trim()) return false;
      return el.getBoundingClientRect().height < 30;
    })
    .slice(0, 3).map(describe);

  return { scrolls, widened, laidOutWidth, scrollWidth: document.documentElement.scrollWidth, vw, overflowing, overlaps, small };
}

const routes = [
  "/admin",
  "/admin/analytics",
  "/admin/vehicles",
  "/admin/vehicles?status=all",
  "/admin/bookings",
  "/admin/users",
  "/admin/agencies",
  "/admin/reports",
  "/admin/support",
  "/admin/inbox",
  "/admin/blacklist",
  "/admin/invoices",
  "/admin/slips",
  "/admin/settings",
  "/admin/settings/email",
  "/admin/settings/notifications",
  "/admin/settings/payments",
];

let browser;
try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);

  // Real rows keep the layouts honest, so detail pages use whatever exists.
  const [{ data: agency }, { data: renter }, { data: thread }, { data: invoice }] = await Promise.all([
    service.from("agencies").select("id").is("deleted_at", null).limit(1).maybeSingle(),
    service.from("profiles").select("id").limit(1).maybeSingle(),
    service.from("support_threads").select("id").limit(1).maybeSingle(),
    service.from("invoices").select("id").limit(1).maybeSingle(),
  ]);
  if (agency) routes.push(`/admin/agencies/${agency.id}/timeline`, `/admin/agencies/${agency.id}/list-vehicle`);
  if (renter) routes.push(`/admin/users/${renter.id}/timeline`);
  if (thread) routes.push(`/admin/support/${thread.id}`);
  if (invoice) routes.push(`/admin/invoices/${invoice.id}`);

  const cookies = await adminSession();
  browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: PASSES[0].width, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  for (const route of routes) {
    const problems = [];
    let notes = [];
    for (const { width, text } of PASSES) {
      await page.setViewportSize({ width, height: 800 });
      let report;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 90_000 });
        await page.waitForTimeout(600);
        // Text scaling, the way a phone browser applies it.
        await page.addStyleTag({ content: `html { font-size: ${text}%; }` });
        await page.waitForTimeout(200);
        report = await page.evaluate(auditInPage, width);
      } catch {
        // A page that redirects tears down the context mid-audit; settle and retry.
        try {
          await page.waitForLoadState("load", { timeout: 30_000 });
          await page.waitForTimeout(800);
          await page.addStyleTag({ content: `html { font-size: ${text}%; }` });
          report = await page.evaluate(auditInPage, width);
        } catch (err) {
          problems.push(`${width}px at ${text}% text: ${String(err.message).split(NEWLINE)[0]}`);
          continue;
        }
      }
      if (report.widened) problems.push(`${width}px at ${text}% text: forces the page wider, so the phone shrinks everything (needs ${report.laidOutWidth}px)`);
      else if (report.scrolls) problems.push(`${width}px at ${text}% text: scrolls sideways (${report.scrollWidth}px wide)`);
      if (report.overflowing.length) problems.push(`${width}px at ${text}% text: past the edge: ${report.overflowing.join(" | ")}`);
      if (report.overlaps.length) problems.push(`${width}px at ${text}% text: overlapping: ${report.overlaps.join(" | ")}`);
      if (report.small.length) notes = report.small;
    }
    if (problems.length) {
      ok = false;
      console.log(`FAIL  ${route}` + NEWLINE + "      " + problems.join(NEWLINE + "      "));
    } else {
      console.log(`PASS  ${route}${notes.length ? `   (small taps: ${notes.join(", ")})` : ""}`);
    }
  }
  await ctx.close();
} catch (err) {
  ok = false;
  console.error("\nRUN FAILED:", err.message);
} finally {
  if (browser) await browser.close();
  for (const id of made.users) {
    await service.from("activity_events").delete().eq("actor_id", id);
    await service.auth.admin.deleteUser(id);
  }
  console.log("\ncleaned up");
}

console.log(ok ? "\nADMIN ON MOBILE: every screen fits." : "\nADMIN ON MOBILE: FAILED");
process.exit(ok ? 0 : 1);
