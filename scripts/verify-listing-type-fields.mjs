#!/usr/bin/env node
/*
 * The listing wizard's dependent fields.
 *
 * Each of these broke separately, so they are checked together:
 *
 *   1. Tile icon      - a tuk-tuk must not be drawn as a lorry.
 *   2. Make / Model    - the hints follow the chosen type, and never clobber
 *                        something the owner already typed.
 *   3. Body type       - a body style picked for the old vehicle type must not
 *                        survive the switch, so Car cannot sit showing "SUV".
 *   4. Transmission    - tiptronic is its own answer, not a kind of automatic.
 *   5. Fees            - cleaning and refuel start empty and mean no fee, so an
 *                        owner never advertises a charge they did not set.
 *   6. Draft           - going back a step keeps everything, and leaving the
 *                        page and returning brings the answers back.
 *
 * Usage: node scripts/verify-listing-type-fields.mjs   (needs a server on 3000)
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://localhost:3000";
const PASSWORD = "Typefields-1!";
const stamp = Date.now().toString(36);

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }),
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const TYPES = {
  Car:       { make: "Toyota",     model: "Aqua",    bodies: ["Sedan", "Hatchback", "Coupe", "Wagon", "Mini", "Other"] },
  SUV:       { make: "Mitsubishi", model: "Montero", bodies: ["SUV", "Crossover", "Pickup", "Wagon", "Other"] },
  Van:       { make: "Toyota",     model: "Hiace",   bodies: ["Van", "Wagon", "Other"] },
  Bike:      { make: "Honda",      model: "Dio",     bodies: [] },
  "Tuk-Tuk": { make: "Bajaj",      model: "RE",      bodies: [] },
};

// A real PNG, so the wizard's photo step gets something it can actually read.
function png(w, h, seed) {
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * stride + 1 + x * 3;
      raw[o] = (x * 255 / w) & 255;
      raw[o + 1] = (y * 255 / h) & 255;
      raw[o + 2] = (seed * 40) & 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let ok = true;
const chk = (l, c, x = "") => { if (!c) ok = false; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "   " + x : ""}`); };
const made = { users: [], agencies: [] };
let browser;

try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);

  const email = `typefields-${stamp}@phone.drivelink.invalid`;
  const { data: owner, error: uErr } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: "Type Fields", phone: `+9477${String(Date.now()).slice(-7)}` },
  });
  if (uErr) throw uErr;
  made.users.push(owner.user.id);
  await service.from("profiles").update({ kyc_status: "verified" }).eq("id", owner.user.id);

  const { data: agency, error: aErr } = await service.from("agencies").insert({
    owner_id: owner.user.id, name: `Type Fields ${stamp}`, slug: `typefields-${stamp}`,
    city: "Colombo", whatsapp_number: "+94770000323", page_type: "personal",
    email: `typefields-${stamp}@example.invalid`, is_verified: true,
    whatsapp_verified_at: new Date().toISOString(),
  }).select("id").single();
  if (aErr) throw aErr;
  made.agencies.push(agency.id);

  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (sErr) throw sErr;
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
  cookies.push({ name: "dl_active_page", value: agency.id, domain: host, path: "/" });

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  const openWizard = async () => {
    await page.goto(`${BASE}/dashboard/vehicles/new`, { waitUntil: "load" });
    await page.locator('button:has-text("Tuk-Tuk"), button:has-text("Photos"), #wizard-photo-input').first()
      .waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(1500);
  };
  const startFresh = async () => {
    const fresh = page.locator(':is(button,a):has-text("Start a fresh listing instead")');
    if (await fresh.count()) { await fresh.first().click(); await page.waitForTimeout(1500); }
  };

  // A tile click before React attaches does nothing at all, and a cold dev
  // server can take many seconds to hydrate. Click until it actually takes.
  const tileIsOn = (label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === l);
    return b ? b.className.includes("border-blue-500") : false;
  }, label);
  const pickTile = async (label) => {
    for (let attempt = 0; attempt < 25; attempt++) {
      await page.locator(`button:has-text("${label}")`).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      if (await tileIsOn(label)) return;
    }
    throw new Error(`the "${label}" tile never became selected - the page may not have hydrated`);
  };

  const hints = () => page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")];
    const make = inputs.find((i) => i.getAttribute("list") === "sl-makes");
    const model = make ? inputs[inputs.indexOf(make) + 1] : null;
    return [make?.placeholder ?? null, model?.placeholder ?? null];
  });
  const bodyField = () => page.evaluate(() => {
    const label = [...document.querySelectorAll("label, p, span")]
      .find((el) => el.textContent.trim() === "Body type (optional)");
    if (!label) return { shown: false, value: null };
    const btn = label.parentElement?.querySelector("button");
    return { shown: true, value: btn ? btn.textContent.trim() : null };
  });
  const openBodySheet = () => page.evaluate(() => {
    const label = [...document.querySelectorAll("label, p, span")]
      .find((el) => el.textContent.trim() === "Body type (optional)");
    label?.parentElement?.querySelector("button")?.click();
  });

  await openWizard();
  await startFresh();
  await pickTile("Car"); // also the hydration gate for everything below

  // ── 1. The tuk-tuk tile draws a tuk-tuk ──
  const svg = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Tuk-Tuk");
    const el = btn?.querySelector("svg");
    return el ? { viewBox: el.getAttribute("viewBox"), fill: el.getAttribute("fill"), paths: el.querySelectorAll("path").length } : null;
  });
  chk("tuk-tuk tile uses the supplied drawing, not a lucide lorry",
    svg?.viewBox === "0 0 512 512" && svg?.paths === 5, JSON.stringify(svg));
  chk("the drawing takes the tile colour", svg?.fill === "currentColor");

  // ── 2. Make / model hints follow the tile ──
  console.log("\nmake / model hints:");
  for (const [label, want] of Object.entries(TYPES)) {
    await pickTile(label);
    const [make, model] = await hints();
    console.log(`  ${label.padEnd(8)} ${make} / ${model}`);
    chk(`${label}: hints match the vehicle`, make === want.make && model === want.model, `got ${make} / ${model}`);
  }
  await page.locator('input[list="sl-makes"]').first().fill("Piaggio");
  await pickTile("Car");
  chk("switching type leaves what the owner already typed alone",
    (await page.locator('input[list="sl-makes"]').first().inputValue()) === "Piaggio");
  await page.locator('input[list="sl-makes"]').first().fill("");

  // ── 3. Body type cannot survive into a type it does not belong to ──
  console.log("\nbody type:");
  for (const [label, want] of Object.entries(TYPES)) {
    await pickTile(label);
    const field = await bodyField();
    chk(`${label}: body-type question ${want.bodies.length ? "is asked" : "is not asked"}`,
      field.shown === (want.bodies.length > 0), field.shown ? `showing "${field.value}"` : "hidden");
  }
  for (const [from, body, to] of [["SUV", "SUV", "Car"], ["Car", "Sedan", "Van"], ["Van", "Van", "SUV"]]) {
    await pickTile(from);
    await openBodySheet();
    await page.waitForTimeout(700);
    await page.locator(`[role="dialog"] button:has-text("${body}"), [role="listbox"] button:has-text("${body}")`)
      .first().click({ timeout: 10_000 });
    await page.waitForTimeout(500);
    chk(`${from}: "${body}" is selected to begin with`, (await bodyField()).value === body);

    await pickTile(to);
    const after = await bodyField();
    const allowed = TYPES[to].bodies;
    const stale = after.shown && after.value && after.value !== "Select…" && !allowed.includes(after.value);
    console.log(`  ${from} "${body}"  ->  ${to} shows "${after.value}"`);
    chk(`${from} "${body}" does not survive into ${to}`, !stale, stale ? `${to} offers ${allowed.join(", ")}` : "");
  }

  // ── Fill step 1 and get past the photos, to reach the later steps ──
  await pickTile("Car");
  await page.locator('input[list="sl-makes"]').first().fill("Toyota");
  const modelInput = page.locator('input[list="sl-makes"]').first().locator("xpath=../../..").locator("input").nth(1);
  await modelInput.fill("Corolla");
  await page.locator('input[placeholder="WP CAB-1234"]').fill(`WP TST-${stamp.slice(-4)}`);
  await pickTile("petrol");
  await page.locator('input[placeholder="4"]').fill("4");
  await page.locator('input[placeholder="1500"]').fill("1500");
  await page.locator('button:has-text("Next")').first().click();
  await page.waitForTimeout(900);

  await page.setInputFiles("#wizard-photo-input",
    [1, 2, 3, 4].map((n) => ({ name: `car-${n}.png`, mimeType: "image/png", buffer: png(640, 420, n) })));
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Next")').first().click();
  await page.waitForTimeout(900);
  const onStep3 = await page.locator('text=/STEP 3 OF 6/i').count();
  chk("reached the rental-options step", onStep3 > 0);

  // ── 4. Tiptronic ──
  const gears = await page.evaluate(() => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === "Transmission");
    return [...(h?.nextElementSibling?.querySelectorAll("button") ?? [])].map((b) => b.textContent.trim());
  });
  console.log(`\ntransmission options: ${gears.join(", ")}`);
  chk("tiptronic is offered alongside automatic and manual",
    gears.length === 3 && gears.includes("tiptronic"), gears.join(", "));
  await pickTile("tiptronic");
  chk("tiptronic can actually be selected", await tileIsOn("tiptronic"));

  // ── 6a. Going back a step keeps the answers ──
  await page.locator('button:has-text("Back")').first().click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Next")').first().click();
  await page.waitForTimeout(800);
  chk("stepping back and forward keeps the transmission choice", await tileIsOn("tiptronic"));

  // ── 5. Fees start empty and mean no fee ──
  await page.locator('button:has-text("Next")').first().click();
  await page.waitForTimeout(900);
  const fees = await page.evaluate(() => {
    const read = (text) => {
      const label = [...document.querySelectorAll("label, p, span")].find((el) => el.textContent.trim() === text);
      const input = label?.parentElement?.querySelector("input");
      return input ? { value: input.value, placeholder: input.placeholder } : null;
    };
    return { cleaning: read("Cleaning fee"), refuel: read("Refuel service fee") };
  });
  console.log(`\nfees: cleaning ${JSON.stringify(fees.cleaning)}  refuel ${JSON.stringify(fees.refuel)}`);
  chk("cleaning fee starts empty, not at Rs 5,000", fees.cleaning?.value === "", `value "${fees.cleaning?.value}"`);
  chk("refuel fee starts empty, not at Rs 1,000", fees.refuel?.value === "", `value "${fees.refuel?.value}"`);
  chk("both show 0 as the hint", fees.cleaning?.placeholder === "0" && fees.refuel?.placeholder === "0");

  // ── 6b. Leaving the page and returning brings the answers back ──
  await page.locator('input[placeholder="0"]').first().waitFor();
  const saved = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("drivelink_vehicle_wizard_draft") ?? "null"); } catch { return null; }
  });
  chk("the draft records which step the owner was on", typeof saved?.step === "number", `step ${saved?.step}`);
  chk("the draft holds what was typed", saved?.make === "Toyota" && saved?.model === "Corolla" && saved?.transmission === "tiptronic",
    `${saved?.make} ${saved?.model} ${saved?.transmission}`);

  await openWizard();
  const landed = await page.evaluate(() => {
    const banner = document.body.innerText.includes("We brought back your unfinished listing");
    const stepLine = document.body.innerText.match(/STEP (\d) OF 6/i);
    return { banner, step: stepLine ? Number(stepLine[1]) : null };
  });
  // Make and Model live on the first step, so step back to read them.
  await page.locator('button:has-text("Back")').first().click();
  await page.waitForTimeout(900);
  const restored = {
    ...landed,
    make: await page.locator('input[list="sl-makes"]').first().inputValue().catch(() => null),
    gearbox: await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("drivelink_vehicle_wizard_draft") ?? "{}").transmission ?? null; } catch { return null; }
    }),
  };
  console.log(`\nafter leaving and returning: make="${restored.make}" step=${restored.step} banner=${restored.banner}`);
  chk("coming back restores what was typed", restored.make === "Toyota", `got "${restored.make}"`);
  chk("stepping back after a restore does not wipe the draft", restored.gearbox === "tiptronic", `gearbox "${restored.gearbox}"`);
  chk("coming back explains itself", restored.banner);
  chk("coming back lands on the photo step, where the lost photos are", restored.step === 2, `step ${restored.step}`);
} catch (runError) {
  ok = false;
  console.error("\nRUN FAILED:", runError.message);
} finally {
  if (browser) await browser.close();
  for (const id of made.agencies) await service.from("agencies").delete().eq("id", id);
  for (const id of made.users) await service.auth.admin.deleteUser(id);
  console.log("\ncleaned up");
}

console.log(ok ? "\nLISTING WIZARD FIELDS: all good." : "\nLISTING WIZARD FIELDS: FAILED");
process.exit(ok ? 0 : 1);
