#!/usr/bin/env node
/*
 * Less friction for owners who list vehicles.
 *
 *  1. A Rental Page on the phone the account already verified needs no second
 *     code; any other number still does, and email is optional.
 *  2. The page form comes pre-filled, and the listing wizard is three steps.
 *  3. A page with an approved listing publishes complete listings straight
 *     away; a page without one waits for review; an owner-hidden listing stays
 *     hidden when edited; owners cannot grant their own page trust.
 *  4. "List it for me": an admin can upload to and draft on an owner's page,
 *     nobody else can, and the owner's confirmation publishes a trusted draft.
 *
 * It never calls the admin moderation or "drafted" routes, because both send
 * real SMS. Page trust is set directly, the way the approval route sets it.
 *
 * Usage: node scripts/verify-owner-friction.mjs   (needs a dev server and migration 128)
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Friction-check-1!";
const stamp = Date.now().toString(36);
const digits = String(Date.now()).slice(-6);

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
const phone = (n) => `+9477${n}${digits}`;

async function makeUser(tag, accountPhone, patch = {}) {
  const email = `friction-${tag}-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `Friction ${tag}` },
  });
  if (error) throw error;
  made.users.push(data.user.id);
  // Phone first: changing it resets phone_verified, so verify in a second write.
  const { error: e1 } = await service.from("profiles").update({ phone: accountPhone, full_name: `Friction ${tag}` }).eq("id", data.user.id);
  if (e1) throw e1;
  const { error: e2 } = await service.from("profiles").update({ phone_verified: true, kyc_status: "verified", ...patch }).eq("id", data.user.id);
  if (e2) throw e2;
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
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  });
  return { db, header: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") };
}

const post = (session, path, body) => fetch(`${BASE}${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: session.header, Origin: BASE },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let plateSeq = 0;
function vehicleRow(agencyId, declared) {
  plateSeq += 1;
  return {
    agency_id: agencyId, make: "Toyota", model: "Vitz", year: 2018,
    vehicle_type: "car", transmission: "automatic", seats: 5, fuel_type: "petrol",
    city: "Colombo", daily_rate_lkr: 6500, slug: `friction-vitz-${stamp}-${plateSeq}`,
    plate_number: `CFX ${digits.slice(-3)}${plateSeq}`, insurance_type: "hire",
    self_drive: true, with_driver: false,
    photos: [1, 2, 3, 4].map((i) => `https://example.invalid/friction-${stamp}-${plateSeq}-${i}.jpg`),
    status: declared ? "pending_review" : "unlisted",
    listing_authority_declared: declared,
    listing_authority_basis: declared ? "registered_owner" : null,
  };
}

async function insertVehicle(db, agencyId, declared = true) {
  const { data, error } = await db.from("vehicles").insert(vehicleRow(agencyId, declared)).select("id, status, auto_published_at").single();
  if (error) throw new Error("vehicle insert failed: " + error.message);
  made.vehicles.push(data.id);
  return data;
}

async function vehicleState(id) {
  const { data } = await service.from("vehicles").select("status, auto_published_at").eq("id", id).single();
  return data;
}

try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);
  const { error: colErr } = await service.from("agencies").select("listing_auto_approve").limit(1);
  if (colErr) throw new Error("Migration 128 is not applied: " + colErr.message);

  const owner = await makeUser("owner", phone(1));
  const sOwner = await sessionFor(owner.email);

  // ── 1. The page number ──
  const p1 = await post(sOwner, "/api/pages", {
    name: `Friction Rentals ${stamp}`, page_type: "personal", city: "Colombo", whatsapp_number: phone(1),
  });
  if (p1.body.page?.id) made.agencies.push(p1.body.page.id);
  chk("page: created with no email", p1.status === 201, `${p1.status} ${p1.body.error ?? ""}`);
  chk("page: the verified signup phone needs no second code", Boolean(p1.body.page?.whatsapp_verified_at));

  const p2 = await post(sOwner, "/api/pages", {
    name: `Friction Second ${stamp}`, page_type: "personal", city: "Kandy", whatsapp_number: phone(2),
  });
  if (p2.body.page?.id) made.agencies.push(p2.body.page.id);
  chk("page: a different number still needs its code", p2.status === 201 && !p2.body.page?.whatsapp_verified_at,
    `${p2.status} ${p2.body.page?.whatsapp_verified_at ?? ""}`);

  const bad = await post(sOwner, "/api/pages", {
    name: `Friction Bad ${stamp}`, page_type: "personal", city: "Kandy", whatsapp_number: phone(3), email: "not-an-email",
  });
  if (bad.body.page?.id) made.agencies.push(bad.body.page.id);
  chk("page: a supplied email is still checked", bad.status === 400, String(bad.status));

  const page1 = p1.body.page.id;
  const page2 = p2.body.page.id;

  await sOwner.db.from("agencies").update({ whatsapp_number: phone(1) }).eq("id", page2);
  let { data: row } = await service.from("agencies").select("whatsapp_verified_at").eq("id", page2).single();
  chk("page: switching to the verified phone verifies it", Boolean(row?.whatsapp_verified_at));
  await sOwner.db.from("agencies").update({ whatsapp_number: phone(4) }).eq("id", page2);
  ({ data: row } = await service.from("agencies").select("whatsapp_verified_at").eq("id", page2).single());
  chk("page: switching to another number resets it", !row?.whatsapp_verified_at);

  // ── 2. The forms ──
  const form = await fetch(`${BASE}/account/pages/new`, { headers: { Cookie: sOwner.header } }).then((r) => r.text());
  chk("form: pre-filled with the account name", form.includes('value="Friction owner"'));
  chk("form: email is optional", /Email[^<]*<span[^>]*>\(optional\)/.test(form));

  const wizard = await fetch(`${BASE}/dashboard/vehicles/new`, { headers: { Cookie: sOwner.header } }).then((r) => r.text());
  chk("wizard: three steps", wizard.includes("Step <!-- -->1<!-- --> of <!-- -->3") || wizard.includes("Step 1 of 3"));
  chk("wizard: offers List it for me", wizard.includes("We can list it for you"));

  // ── 3. Page trust ──
  const waiting = await insertVehicle(sOwner.db, page1);
  chk("trust: a new page's listing waits for review", waiting.status === "pending_review", waiting.status);

  await service.from("agencies").update({ listing_auto_approve: true }).eq("id", page1);
  const live = await insertVehicle(sOwner.db, page1);
  chk("trust: an approved page's complete listing goes live", live.status === "available" && Boolean(live.auto_published_at), live.status);

  const incomplete = await insertVehicle(sOwner.db, page1, false);
  chk("trust: an undeclared listing never goes live", incomplete.status === "unlisted", incomplete.status);

  await sOwner.db.from("vehicles").update({ daily_rate_lkr: 7000 }).eq("id", live.id);
  chk("trust: editing a live listing keeps it live", (await vehicleState(live.id)).status === "available");

  await service.from("vehicles").update({ status: "unlisted" }).eq("id", live.id);
  await sOwner.db.from("vehicles").update({ daily_rate_lkr: 7200 }).eq("id", live.id);
  chk("trust: a listing the owner hid stays hidden when edited", (await vehicleState(live.id)).status !== "available",
    (await vehicleState(live.id)).status);

  const { error: selfTrust } = await sOwner.db.from("agencies").update({ listing_auto_approve: false }).eq("id", page1);
  chk("trust: owners cannot change their own page trust", Boolean(selfTrust), selfTrust?.message ?? "no error");

  // ── 4. List it for me ──
  const admin = await makeUser("admin", phone(5), { role: "admin" });
  const sAdmin = await sessionFor(admin.email);
  const signAdmin = await post(sAdmin, "/api/storage/sign", {
    prefix: "vehicle-photos", filename: "front.jpg", contentType: "image/jpeg", size: 2048, agencyId: page1,
  });
  chk("draft: an admin can upload photos to an owner's page",
    signAdmin.status === 200 && String(signAdmin.body.finalKey ?? "").includes(page1), `${signAdmin.status} ${signAdmin.body.error ?? ""}`);

  const stranger = await makeUser("stranger", phone(6));
  const sStranger = await sessionFor(stranger.email);
  const signStranger = await post(sStranger, "/api/storage/sign", {
    prefix: "vehicle-photos", filename: "front.jpg", contentType: "image/jpeg", size: 2048, agencyId: page1,
  });
  chk("draft: nobody else can upload to someone's page", signStranger.status === 403, String(signStranger.status));

  const draft = await insertVehicle(sAdmin.db, page1, false);
  chk("draft: the admin's draft is private", draft.status === "unlisted", draft.status);

  await sOwner.db.from("vehicles")
    .update({ listing_authority_declared: true, listing_authority_basis: "registered_owner" })
    .eq("id", draft.id);
  chk("draft: the owner confirming it on a trusted page publishes it", (await vehicleState(draft.id)).status === "available",
    (await vehicleState(draft.id)).status);
} catch (err) {
  ok = false;
  console.error("\nRUN FAILED:", err.message);
} finally {
  for (const id of made.vehicles) {
    await service.from("notification_outbox").delete().like("event_key", `listing:${id}%`);
    await service.from("vehicles").delete().eq("id", id);
  }
  for (const id of made.agencies) await service.from("agencies").delete().eq("id", id);
  for (const id of made.users) {
    await service.from("activity_events").delete().eq("actor_id", id);
    await service.auth.admin.deleteUser(id);
  }
  console.log("\ncleaned up");
}

console.log(ok ? "\nOWNER FRICTION: all checks passed." : "\nOWNER FRICTION: FAILED");
process.exit(ok ? 0 : 1);
