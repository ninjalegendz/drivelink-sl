#!/usr/bin/env node

// Self-cleaning deployed check for the account-deletion reauthentication gate.
// It inserts a known temporary challenge directly, so no real SMS/email is sent.

import fs from "node:fs";
import { chromium } from "playwright";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { hashOtp } from "../src/lib/sms/otp";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Deletion-reauth-verify-1!";
const CODE = "123456";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let userId: string | null = null;
let passed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function request(path: string, cookie: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

try {
  const email = `delete-reauth-${stamp}@phone.drivelink.invalid`;
  const phone = `+947${String(Date.now()).slice(-8)}`;
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: "Deletion reauth test", phone },
  });
  if (error || !data.user) throw error ?? new Error("Could not create temporary account.");
  userId = data.user.id;
  const { error: profileError } = await service.from("profiles").update({ email: null, phone_verified: true }).eq("id", userId);
  if (profileError) throw profileError;

  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const signedIn = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Could not sign in temporary account.");
  const jar = new Map<string, string>();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await ssr.auth.setSession({ access_token: signedIn.data.session.access_token, refresh_token: signedIn.data.session.refresh_token });
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: new URL(BASE).hostname, path: "/", secure: BASE.startsWith("https") })));
    const page = await context.newPage();
    await page.goto(`${BASE}/account/settings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByText("What happens on delete:", { exact: true }).waitFor({ timeout: 15000 });
    const freshPhonePrompt = page.getByText("Confirm with your phone", { exact: true });
    const promptVisible = await freshPhonePrompt.isVisible().catch(() => false);
    const visibleText = promptVisible ? "" : (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1800);
    check("the deletion screen explains the fresh phone confirmation", promptVisible, visibleText);
  } finally {
    await browser.close();
  }

  const denied = await request("/api/account/delete", cookie, "POST", { confirmation: "DELETE" });
  check("a signed-in account cannot delete itself without a fresh code", denied.status === 409 && /fresh deletion code/i.test(String(denied.json.error)), JSON.stringify(denied));

  const codeHash = await hashOtp(CODE, `${userId}:account_delete`);
  const { error: challengeError } = await service.from("account_action_challenges").upsert({
    user_id: userId, purpose: "account_delete", code_hash: codeHash,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0, send_count: 1,
  }, { onConflict: "user_id,purpose" });
  if (challengeError) throw challengeError;

  const verified = await request("/api/account/delete/challenge", cookie, "PUT", { code: CODE });
  check("the deployed route accepts the fresh deletion code once", verified.status === 200 && verified.json.ok === true, JSON.stringify(verified));

  const deleted = await request("/api/account/delete", cookie, "POST", { confirmation: "DELETE" });
  const { data: profile } = await service.from("profiles").select("deleted_at,email,full_name").eq("id", userId).single();
  check("the verified code unlocks exactly one account deletion", deleted.status === 200 && Boolean(profile?.deleted_at) && profile?.email === null && profile?.full_name?.startsWith("Deleted user #"), JSON.stringify({ deleted, profile }));

  const replay = await request("/api/account/delete", cookie, "POST", { confirmation: "DELETE" });
  check("the same session cannot replay the deletion confirmation", replay.status === 401 || replay.status === 409, JSON.stringify(replay));

  console.log(`\n${passed} deployed account-deletion reauthentication checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  if (userId) await service.auth.admin.deleteUser(userId).catch((error) => console.error("cleanup", error.message));
}
