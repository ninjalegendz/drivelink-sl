#!/usr/bin/env node

// Self-cleaning proof against the deployed ownership-transfer routes. It
// exercises both account identities, an unauthorised third party, the 24-hour
// guard, and cancellation. A real phone-code delivery needs a human account,
// so the code's database path is covered in verify-page-transfers instead.

import fs from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Page-transfer-verify-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = [];
let pageId = null;
let transferId = null;
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function sessionCookie(email) {
  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("No test session was created.");
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, cookie, options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { Cookie: cookie, "Content-Type": "application/json", ...(options.headers ?? {}) } });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function createTestUser(label) {
  const email = `page-transfer-${label}-${stamp}@example.invalid`;
  const phoneDigit = { owner: "1", recipient: "2", stranger: "3" }[label];
  if (!phoneDigit) throw new Error("Unknown transfer-test account label.");
  const phone = `+999${String(Date.now()).slice(-7)}${phoneDigit}`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Transfer ${label}`, phone } });
  if (error || !data.user) throw error ?? new Error("Could not create a test account.");
  users.push(data.user.id);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const profile = await service.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (profile.data) break;
    if (attempt === 59) throw new Error("Temporary account did not receive a DriveLink profile.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const { error: updateError } = await service.from("profiles").update({
    kyc_status: "verified", phone, email, email_verified_at: null,
  }).eq("id", data.user.id);
  if (updateError) throw updateError;
  // Changing a phone deliberately clears this flag in the database trigger.
  // Mirror a completed OTP verification in a separate write.
  const { error: verifiedError } = await service.from("profiles").update({ phone_verified: true }).eq("id", data.user.id);
  if (verifiedError) throw verifiedError;
  const { data: profile, error: profileError } = await service.from("profiles")
    .select("id,email,phone,phone_verified,kyc_status,is_blacklisted,deleted_at")
    .eq("id", data.user.id).single();
  if (profileError || !profile?.phone_verified || profile.kyc_status !== "verified" || profile.is_blacklisted || profile.deleted_at || profile.email !== email) {
    throw new Error(`Temporary profile setup did not persist: ${JSON.stringify(profile)} ${profileError?.message ?? ""}`);
  }
  return { id: data.user.id, email, cookie: await sessionCookie(email) };
}

async function cleanup() {
  // Notifications this run queued outlive the page and the accounts, and a
  // dead one keeps the operations health check reporting an incident. Three
  // left behind on 14 August generated alert emails every five minutes for
  // days, so clear them with the rest of the fixture.
  if (pageId) {
    const { data: transfers } = await service
      .from("rental_page_transfers").select("id").eq("agency_id", pageId);
    for (const transfer of transfers ?? []) {
      await service.from("notification_outbox").delete().like("event_key", `page-transfer:${transfer.id}:%`);
    }
    await service.from("agencies").delete().eq("id", pageId);
  }
  for (const userId of users) await service.auth.admin.deleteUser(userId);
}

try {
  const [owner, recipient, stranger] = await Promise.all([createTestUser("owner"), createTestUser("recipient"), createTestUser("stranger")]);
  check("temporary owner, recipient, and unrelated accounts are ready", users.length === 3);

  const created = await request("/api/pages", owner.cookie, {
    method: "POST",
    body: JSON.stringify({ name: `Transfer page ${stamp}`, page_type: "personal", city: "Colombo", whatsapp_number: "0773456789", email: `transfer-page-${stamp}@example.invalid` }),
  });
  check("owner creates a temporary Rental Page through the deployed route", created.status === 201 && Boolean(created.json.page?.id), JSON.stringify(created.json));
  pageId = created.json.page.id;

  const started = await request(`/api/pages/${pageId}/transfer`, owner.cookie, { method: "POST", body: JSON.stringify({ action: "start", email: recipient.email }) });
  check("owner can request a two-sided transfer", started.status === 200 && Boolean(started.json.transfer?.id), JSON.stringify(started.json));
  transferId = started.json.transfer.id;
  const beforeAnswer = await service.from("agencies").select("owner_id").eq("id", pageId).single();
  check("requesting does not change the page owner", beforeAnswer.data?.owner_id === owner.id);

  const invitationScreen = await fetch(`${BASE}/account`, { headers: { Cookie: recipient.cookie } });
  const invitationHtml = await invitationScreen.text();
  check("recipient can see the ownership decision in Account", invitationScreen.status === 200 && invitationHtml.includes("Rental Page ownership requests") && invitationHtml.includes(`Transfer page ${stamp}`));

  const intercepted = await request(`/api/account/page-transfers/${transferId}`, stranger.cookie, { method: "POST", body: JSON.stringify({ action: "accept" }) });
  check("an unrelated account cannot accept the request", intercepted.status === 409);

  const accepted = await request(`/api/account/page-transfers/${transferId}`, recipient.cookie, { method: "POST", body: JSON.stringify({ action: "accept" }) });
  check("recipient acceptance starts the cancellation period", accepted.status === 200 && accepted.json.status === "cooling_off", JSON.stringify(accepted.json));
  const afterAnswer = await service.from("agencies").select("owner_id").eq("id", pageId).single();
  check("accepting does not move ownership before the cancellation period", afterAnswer.data?.owner_id === owner.id);

  const earlyCompletion = await request(`/api/pages/${pageId}/transfer`, owner.cookie, { method: "POST", body: JSON.stringify({ action: "complete", transferId, code: "000000" }) });
  check("the final completion endpoint rejects an early handoff", earlyCompletion.status === 409);

  const cancelled = await request(`/api/pages/${pageId}/transfer`, owner.cookie, { method: "POST", body: JSON.stringify({ action: "cancel", transferId }) });
  check("the owner can cancel during the cooling period", cancelled.status === 200 && cancelled.json.status === "cancelled", JSON.stringify(cancelled.json));
  const finalState = await service.from("rental_page_transfers").select("status").eq("id", transferId).single();
  const finalOwner = await service.from("agencies").select("owner_id").eq("id", pageId).single();
  check("cancellation preserves the original page owner", finalState.data?.status === "cancelled" && finalOwner.data?.owner_id === owner.id);

  console.log(`\n${passed} deployed ownership-transfer checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("cleanup", error instanceof Error ? error.message : error));
}
