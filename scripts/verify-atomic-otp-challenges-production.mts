#!/usr/bin/env node

// Self-cleaning production check for the routes that use atomic OTP records.
// It plants known hashes directly, so it sends no real SMS or email.

import fs from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { hashOtp } from "../src/lib/sms/otp";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Atomic-otp-verify-1!";
const CODE = "123456";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cleanup = { userIds: [] as string[], subjects: [] as string[], signupPhone: "", pageId: null as string | null };
let passed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function waitForProfile(userId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await service.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the temporary profile.");
}

async function sessionCookie(email: string) {
  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("Could not sign in temporary account.");

  const jar = new Map<string, string>();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path: string, method: string, body: Record<string, unknown>, cookie?: string) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function seedChallenge(subject: string, purpose: "login" | "phone_verify" | "signup") {
  cleanup.subjects.push(subject);
  const codeHash = await hashOtp(CODE, `otp-v1:${purpose}:${subject}`);
  const { error } = await service.from("otp_challenges").upsert({
    subject_key: subject,
    purpose,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    attempts: 0,
    send_count: 1,
  }, { onConflict: "subject_key,purpose" });
  if (error) throw error;
}

try {
  const email = `atomic-otp-${stamp}@phone.drivelink.invalid`;
  const phone = `+947${String(Date.now()).slice(-8)}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Atomic OTP test", phone },
  });
  if (error || !data.user) throw error ?? new Error("Could not create temporary account.");
  const userId = data.user.id;
  cleanup.userIds.push(userId);
  await waitForProfile(userId);
  const { error: profileError } = await service.from("profiles").update({ email, phone, phone_verified: false }).eq("id", userId);
  if (profileError) throw profileError;
  const cookie = await sessionCookie(email);

  const loginSubject = `profile:${userId}`;
  await seedChallenge(loginSubject, "login");
  const loggedIn = await request("/api/auth/login/verify-code", "POST", { identifier: email, code: CODE });
  check("the deployed login route accepts one current atomic code", loggedIn.status === 200 && loggedIn.json.ok === true, JSON.stringify(loggedIn));

  const replayedLogin = await request("/api/auth/login/verify-code", "POST", { identifier: email, code: CODE });
  check("the deployed login route refuses a replayed code", replayedLogin.status === 400 && /already used/i.test(String(replayedLogin.json.error)), JSON.stringify(replayedLogin));

  const phoneSubject = `profile:${userId}`;
  await seedChallenge(phoneSubject, "phone_verify");
  const phoneVerified = await request("/api/phone/verify-otp", "POST", { code: CODE }, cookie);
  const { data: profile } = await service.from("profiles").select("phone_verified").eq("id", userId).single();
  check("the deployed phone route consumes its own code and proves the number", phoneVerified.status === 200 && phoneVerified.json.ok === true && profile?.phone_verified === true, JSON.stringify({ phoneVerified, profile }));

  const { data: page, error: pageError } = await service.from("agencies").insert({
    owner_id: userId,
    name: `Atomic OTP page ${stamp}`,
    city: "Colombo",
    whatsapp_number: phone,
    page_type: "personal",
    is_verified: false,
  }).select("id").single();
  if (pageError || !page) throw pageError ?? new Error("Could not create temporary Rental Page.");
  cleanup.pageId = page.id;
  await seedChallenge(`page:${userId}:${page.id}`, "phone_verify");
  const pageVerified = await request(`/api/pages/${page.id}/verify-phone`, "POST", { code: CODE }, cookie);
  const { data: verifiedPage } = await service.from("agencies").select("whatsapp_verified_at").eq("id", page.id).single();
  check("the deployed Rental Page route consumes a rate-limited code", pageVerified.status === 200 && pageVerified.json.verified === true && Boolean(verifiedPage?.whatsapp_verified_at), JSON.stringify({ pageVerified, verifiedPage }));

  cleanup.signupPhone = `+947${String(Date.now() + 1).slice(-8)}`;
  const signupSubject = `signup:${cleanup.signupPhone}`;
  await seedChallenge(signupSubject, "signup");
  const { error: pendingError } = await service.from("pending_signups").upsert({
    phone: cleanup.signupPhone,
    full_name: "Atomic signup test",
    email: null,
    agency_address: "Colombo test address",
    otp_hash: "legacy-placeholder-hash",
    otp_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    otp_attempts: 0,
    otp_send_count: 1,
    otp_last_sent: new Date().toISOString(),
    otp_channel: "sms",
  }, { onConflict: "phone" });
  if (pendingError) throw pendingError;
  const signup = await request("/api/auth/signup/verify", "POST", { phone: cleanup.signupPhone, code: CODE });
  const { data: signupProfile } = await service.from("profiles").select("id,phone_verified").eq("phone", cleanup.signupPhone).maybeSingle();
  if (signupProfile?.id) cleanup.userIds.push(signupProfile.id);
  check("the deployed signup route accepts its atomic code exactly once", signup.status === 200 && signup.json.ok === true && signupProfile?.phone_verified === true, JSON.stringify({ signup, signupProfile }));

  console.log(`\n${passed} deployed atomic OTP route checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  if (cleanup.pageId) {
    const { error } = await service.from("agencies").delete().eq("id", cleanup.pageId);
    if (error) console.error("cleanup Rental Page", error.message);
  }
  if (cleanup.signupPhone) {
    const { error } = await service.from("pending_signups").delete().eq("phone", cleanup.signupPhone);
    if (error) console.error("cleanup pending signup", error.message);
  }
  if (cleanup.subjects.length) {
    const { error } = await service.from("otp_challenges").delete().in("subject_key", cleanup.subjects);
    if (error) console.error("cleanup challenge", error.message);
  }
  for (const userId of cleanup.userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) console.error("cleanup user", error.message);
  }
}
