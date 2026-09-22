#!/usr/bin/env node
/*
 * Owners can put their photos in the order renters see them.
 *
 * The first photo is the cover, which made order matter while there was no way
 * to change it: the only fix was deleting every photo and adding them back in
 * the right order. In the edit form it was worse, because uploaded photos and
 * freshly picked files lived in separate lists, so a new photo could never be
 * placed before an old one.
 *
 * Checked here:
 *   - the wizard reorders with the arrows and the make-cover star
 *   - the edit form saves the order shown, and can put a new photo first
 *   - scrolling the wheel over a focused number field does not change it
 *
 * Usage: node scripts/verify-photo-order.mjs   (needs a dev server)
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Photoorder-1!";
const stamp = Date.now().toString(36);
const digits = String(Date.now()).slice(-6);
const NEWLINE_MARK = String.fromCharCode(10);
const ACTIVE_PAGE_COOKIE = "dl_active_page";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let ok = true;
const chk = (l, c, x = "") => { if (!c) ok = false; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "   " + x : ""}`); };
const made = { users: [], agencies: [], vehicles: [] };

/** A tiny valid PNG, so the file picker gets real image bytes. */
function png(r, g, b) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  // Node 20 has no zlib.crc32, so keep a local one.
  function crc32(buf) {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (~c) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.from([0, r, g, b]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function makeOwner() {
  const email = `photo-order-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Photo Order Owner" },
  });
  if (error) throw error;
  made.users.push(data.user.id);
  await service.from("profiles").update({ phone: `+9477${digits}` }).eq("id", data.user.id);
  await service.from("profiles").update({ phone_verified: true, kyc_status: "verified" }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

async function sessionCookies(email, agencyId) {
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
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: host, path: "/" }));
  cookies.push({ name: ACTIVE_PAGE_COOKIE, value: agencyId, domain: host, path: "/" });
  return cookies;
}

/** The photo tiles, in the order they appear. */
const tileOrder = (page) => page.$$eval("[data-photo-key]", (els) => els.map((e) => e.dataset.photoKey));

let browser;
try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);

  const owner = await makeOwner();
  const { data: agency, error: aErr } = await service.from("agencies").insert({
    owner_id: owner.id, name: `Photo Order Rentals ${stamp}`, slug: `photo-order-${stamp}`,
    city: "Colombo", whatsapp_number: `+9477${digits}`, page_type: "personal",
    is_verified: true, whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (aErr) throw aErr;
  made.agencies.push(agency.id);

  const seeded = [1, 2, 3, 4].map((i) => `https://example.invalid/photo-order-${stamp}-${i}.jpg`);
  const { data: vehicle, error: vErr } = await service.from("vehicles").insert({
    agency_id: agency.id, make: "Toyota", model: "Aqua", year: 2019,
    vehicle_type: "car", transmission: "automatic", seats: 5, fuel_type: "petrol",
    city: "Colombo", daily_rate_lkr: 7500, slug: `photo-order-aqua-${stamp}`,
    plate_number: `CPO ${digits.slice(-4)}`, insurance_type: "hire",
    self_drive: true, with_driver: false, doors: 4, engine_cc: 1500,
    photos: seeded, status: "unlisted",
    listing_authority_declared: true, listing_authority_basis: "registered_owner",
    listing_authority_confirmed_at: new Date().toISOString(),
    listing_authority_confirmed_by: owner.id,
    listing_authority_declaration_version: "vehicle-authority-v1",
  }).select("id").single();
  if (vErr) throw vErr;
  made.vehicles.push(vehicle.id);

  const cookies = await sessionCookies(owner.email, agency.id);
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // ── The wizard ──
  await page.goto(`${BASE}/dashboard/vehicles/new`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.locator('label:has-text("Make") input').first().fill("Toyota");
  await page.locator('label:has-text("Model") input').first().fill("Vitz");
  await page.locator('label:has-text("Registration plate") input').first().fill(`CPW ${digits.slice(-4)}`);
  await page.getByRole("button", { name: "petrol", exact: true }).click();
  await page.locator('label:has-text("Doors") input').first().fill("4");
  await page.locator('label:has-text("Engine cc") input').first().fill("1300");
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.waitForTimeout(500);

  await page.setInputFiles("#wizard-photo-input", [
    { name: "one.png",   mimeType: "image/png", buffer: png(255, 0, 0) },
    { name: "two.png",   mimeType: "image/png", buffer: png(0, 255, 0) },
    { name: "three.png", mimeType: "image/png", buffer: png(0, 0, 255) },
    { name: "four.png",  mimeType: "image/png", buffer: png(255, 255, 0) },
  ]);
  await page.waitForTimeout(700);

  const initial = await tileOrder(page);
  chk("wizard: four photos land in the strip", initial.length === 4, String(initial.length));

  await page.getByRole("button", { name: "Move photo 1 of 4 later" }).click();
  await page.waitForTimeout(250);
  const swapped = await tileOrder(page);
  chk("wizard: the arrow moves a photo one place",
    swapped[0] === initial[1] && swapped[1] === initial[0] && swapped[3] === initial[3]);

  await page.getByRole("button", { name: "Make photo 4 of 4 the cover" }).click();
  await page.waitForTimeout(250);
  const starred = await tileOrder(page);
  chk("wizard: the star sends a photo to the front",
    starred[0] === swapped[3] && starred[1] === swapped[0] && starred.length === 4);

  const coverOnFirst = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll("[data-photo-key]")];
    return tiles.map((t) => t.textContent?.includes("Cover") ?? false);
  });
  chk("wizard: the cover badge follows the first photo",
    coverOnFirst[0] === true && coverOnFirst.slice(1).every((c) => c === false));

  chk("wizard: the first photo cannot move earlier",
    await page.getByRole("button", { name: "Move photo 1 of 4 earlier" }).isDisabled());

  await page.getByRole("button", { name: "Remove photo 2 of 4" }).click();
  await page.waitForTimeout(250);
  const afterRemove = await tileOrder(page);
  chk("wizard: removing a photo keeps the rest in order",
    afterRemove.length === 3 && afterRemove[0] === starred[0] && afterRemove[1] === starred[2]);

  // ── The wheel over a number field ──
  const yearField = page.locator('label:has-text("Year") input').first();
  await page.getByRole("button", { name: /^Back/ }).click();
  await page.waitForTimeout(400);
  await yearField.click();
  const before = await yearField.inputValue();
  await yearField.hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(250);
  chk("wheel: scrolling over a focused number field leaves it alone",
    (await yearField.inputValue()) === before, `${before} -> ${await yearField.inputValue()}`);

  const scrolled = await page.evaluate(async () => {
    const start = window.scrollY;
    window.scrollBy(0, 200);
    await new Promise((r) => setTimeout(r, 150));
    return window.scrollY > start;
  });
  chk("wheel: the page itself still scrolls", scrolled);

  // ── The edit form, where the saved order is what matters ──
  await page.goto(`${BASE}/dashboard/vehicles/${vehicle.id}/edit`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(900);
  const editInitial = await tileOrder(page);
  chk("edit: shows the saved photos in order",
    editInitial.length === 4 && editInitial[0] === seeded[0] && editInitial[3] === seeded[3],
    editInitial.join(", ").slice(0, 80));

  await page.getByRole("button", { name: "Make photo 4 of 4 the cover" }).click();
  await page.waitForTimeout(250);
  const editReordered = await tileOrder(page);
  const expected = [seeded[3], seeded[0], seeded[1], seeded[2]];
  chk("edit: the star reorders the strip", editReordered.join("|") === expected.join("|"));

  await page.getByRole("button", { name: /^Save changes$/ }).click();
  // The form keeps an empty alert container for its error box, so only text
  // in it means the save was actually refused.
  let saveOutcome = "saved";
  try {
    await page.waitForURL(/\/dashboard\/vehicles(\?|$)/, { timeout: 60_000 });
  } catch {
    const shown = (await page.locator('[role="alert"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    saveOutcome = shown.length ? `refused: ${shown.join(" | ").slice(0, 160)}` : "stayed on the form with no error shown";
  }
  chk("edit: the form saves", saveOutcome === "saved", saveOutcome);
  await page.waitForTimeout(600);

  const { data: saved } = await service.from("vehicles").select("photos").eq("id", vehicle.id).single();
  chk("edit: the new order is what gets saved",
    (saved?.photos ?? []).join("|") === expected.join("|"),
    (saved?.photos ?? []).join(", ").slice(0, 90));

  await ctx.close();
} catch (err) {
  ok = false;
  console.error("\nRUN FAILED:", err.message);
} finally {
  if (browser) await browser.close();
  for (const id of made.vehicles) {
    await service.from("notification_outbox").delete().like("event_key", `listing:${id}%`);
    await service.from("vehicles").delete().eq("id", id);
  }
  // The wizard listing above is created by the browser, so clear the page's fleet.
  for (const id of made.agencies) {
    await service.from("vehicles").delete().eq("agency_id", id);
    await service.from("agencies").delete().eq("id", id);
  }
  for (const id of made.users) {
    await service.from("activity_events").delete().eq("actor_id", id);
    await service.auth.admin.deleteUser(id);
  }
  console.log("\ncleaned up");
}

console.log(ok ? "\nPHOTO ORDER: owners control the order, and the wheel leaves numbers alone." : "\nPHOTO ORDER: FAILED");
process.exit(ok ? 0 : 1);
