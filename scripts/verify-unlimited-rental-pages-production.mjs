#!/usr/bin/env node

// Self-cleaning deployed-route proof that a verified account can create more
// than five Rental Pages. The sixth page is the regression check.

import fs from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Unlimited-pages-verify-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let userId = null;
const pageIds = [];
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function sessionHeader(email) {
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

async function request(cookie, body) {
  const response = await fetch(`${BASE}/api/pages`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function cleanup() {
  if (pageIds.length) await service.from("agencies").delete().in("id", pageIds);
  if (userId) await service.auth.admin.deleteUser(userId);
}

try {
  const email = `unlimited-pages-${stamp}@example.invalid`;
  const phone = `+947${String(Date.now()).slice(-8)}`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Unlimited pages test", phone } });
  if (error || !data.user) throw error ?? new Error("No test account was created.");
  userId = data.user.id;

  let profileReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const profile = await service.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (profile.data) {
      profileReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check("temporary account receives its DriveLink profile", profileReady);
  const { error: profileError } = await service.from("profiles").update({ kyc_status: "verified", phone: " ".repeat(50), email_verified_at: null }).eq("id", userId);
  if (profileError) throw profileError;
  const cookie = await sessionHeader(email);

  for (let index = 1; index <= 6; index += 1) {
    const page = await request(cookie, {
      name: `Unlimited page ${stamp} ${index}`,
      page_type: "personal",
      city: "Colombo",
      whatsapp_number: `077${String(3000000 + index)}`,
      email: `unlimited-page-${stamp}-${index}@example.invalid`,
    });
    check(`page ${index} is created through the deployed route`, page.status === 201 && !!page.json.page?.id, JSON.stringify(page.json));
    pageIds.push(page.json.page.id);
  }
  check("the sixth page is accepted instead of hitting a hidden five-page cap", pageIds.length === 6);
  console.log(`\n${passed} deployed unlimited-page checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("cleanup", error instanceof Error ? error.message : error));
}
