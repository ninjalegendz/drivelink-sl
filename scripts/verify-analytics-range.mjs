/*
 * Does the analytics range selector actually change the numbers?
 *
 * The traffic panel froze its server prop in useState, so the figures only
 * moved when the 20s poll happened to land. This drives the four tabs and
 * compares what the panel prints against the very RPC the server calls for
 * that range. A frozen panel shows one set of numbers under all four labels.
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Rangecheck-1!";
const stamp = Date.now().toString(36);
const RANGES = [
  ["24h", "Last 24 hours", 24],
  ["7d", "Last 7 days", 24 * 7],
  ["30d", "Last 30 days", 24 * 30],
  ["90d", "Last 90 days", 24 * 90],
];

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let ok = true;
const chk = (label, pass, extra = "") => {
  if (!pass) ok = false;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? "   " + extra : ""}`);
};
const made = { users: [], sessions: [] };
let browser;

try {
  // The page must be DriveLink. Another project has squatted :3000 before, and
  // the whole run then measures the wrong app.
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);

  // Seed one visitor per bucket so the four ranges cannot coincidentally match.
  for (const hours of [2, 24 * 4, 24 * 20, 24 * 60]) {
    const at = new Date(Date.now() - hours * 3_600_000).toISOString();
    const id = crypto.randomUUID();
    const { error } = await service.from("traffic_sessions").insert({
      id, first_seen_at: at, last_seen_at: at, landing_path: `/rangecheck-${stamp}`,
      source_category: "direct", device_type: "desktop", browser_family: "chrome", page_view_count: 1,
    });
    if (error) throw error;
    made.sessions.push(id);
    const { error: eventError } = await service.from("traffic_events")
      .insert({ session_id: id, event_name: "page_view", path: `/rangecheck-${stamp}`, created_at: at });
    if (eventError) throw eventError;
  }
  console.log("seeded 4 visitors, one in each range bucket\n");

  // What the server itself would render for each range.
  const expected = {};
  for (const [key, , hours] of RANGES) {
    const since = new Date(Date.now() - hours * 3_600_000).toISOString();
    const { data, error } = await service.rpc("traffic_analytics_snapshot", { p_since: since });
    if (error) throw error;
    expected[key] = { visitors: data.visitors, page_views: data.page_views };
  }
  console.log("expected, straight from the RPC:");
  for (const [key] of RANGES) {
    console.log(`  ${key.padEnd(4)} visitors=${expected[key].visitors}  page views=${expected[key].page_views}`);
  }
  const distinct = new Set(RANGES.map(([k]) => expected[k].visitors)).size;
  chk("the four ranges genuinely differ, so a frozen panel cannot pass", distinct === 4, `${distinct} distinct visitor totals`);

  const email = `rangecheck-${stamp}@phone.drivelink.invalid`;
  const { data: admin, error: userError } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: "Range Check", phone: `+9470${String(Date.now()).slice(-7)}` },
  });
  if (userError) throw userError;
  made.users.push(admin.user.id);
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

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  const tile = async (label) => {
    const text = await page.evaluate((wanted) => {
      for (const el of document.querySelectorAll("div")) {
        const name = el.querySelector(":scope > div > span");
        const value = el.querySelector(":scope > p");
        if (name && value && name.textContent.trim() === wanted) return value.textContent.trim();
      }
      return null;
    }, label);
    return text === null ? null : Number(text.replace(/[^0-9]/g, ""));
  };

  await page.goto(`${BASE}/admin/analytics`, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  chk("no Refresh button anywhere on the page", await page.locator('button:has-text("Refresh")').count() === 0);
  const panelText = await page.locator("section").first().innerText();
  chk("the panel says it updates on its own", /updates every 20 seconds/i.test(panelText));

  console.log("\nwhat the panel actually prints:");
  for (const [key, label] of RANGES) {
    await page.locator(`button:has-text("${label}")`).first().click();
    await page.waitForFunction(
      () => !document.querySelector("button[aria-pressed]:disabled"),
      null, { timeout: 25_000 },
    ).catch(() => {});
    await page.waitForTimeout(1500);

    const visitors = await tile("Visitors");
    const views = await tile("Page views");
    const url = new URL(page.url());
    console.log(`  ${label.padEnd(15)} range=${(url.searchParams.get("range") ?? "-").padEnd(4)} visitors=${visitors}  page views=${views}`);

    chk(`${label}: the url carries the range`, (url.searchParams.get("range") ?? "30d") === key);
    // Real traffic can land mid-run, so allow a little drift.
    chk(`${label}: visitors match the RPC for this range`,
      visitors !== null && Math.abs(visitors - expected[key].visitors) <= 2,
      `panel ${visitors} vs rpc ${expected[key].visitors}`);
    chk(`${label}: page views match the RPC for this range`,
      views !== null && Math.abs(views - expected[key].page_views) <= 3,
      `panel ${views} vs rpc ${expected[key].page_views}`);
  }
} catch (runError) {
  ok = false;
  console.error("\nRUN FAILED:", runError.message);
} finally {
  if (browser) await browser.close();
  for (const id of made.sessions) await service.from("traffic_sessions").delete().eq("id", id);
  for (const id of made.users) await service.auth.admin.deleteUser(id);
  console.log(`\ncleaned up: ${made.sessions.length} seeded visitors, ${made.users.length} admin account`);
}

console.log(ok ? "\nRANGE SELECTOR: every tab shows its own numbers." : "\nRANGE SELECTOR: FAILED");
process.exit(ok ? 0 : 1);
