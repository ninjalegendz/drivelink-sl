#!/usr/bin/env node

import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Deletion-check-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
    }),
);
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_APP_URL = BASE;
process.env.RESEND_API_KEY = "deletion-verifier-key";
process.env.RESEND_FROM_EMAIL = "test@drivelink.invalid";
process.env.NODE_ENV = "production";

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { RecoveryEmailDeliveryError, restoreOwnedPages, softDeleteAgency, softDeleteUser } = await import("../src/lib/account/deletion.ts");
const createdUsers = [];
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function createUser(label, phoneOnly = false) {
  const email = phoneOnly
    ? `deletion-${label}-${stamp}@phone.drivelink.invalid`
    : `deletion-${label}-${stamp}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Deletion ${label}`, phone: `+947700${String(createdUsers.length).padStart(5, "0")}` },
  });
  if (error) throw error;
  createdUsers.push(data.user.id);
  const { error: profileError } = await service
    .from("profiles")
    .update({ email, full_name: `Deletion ${label}` })
    .eq("id", data.user.id);
  if (profileError) throw profileError;
  return { id: data.user.id, email };
}

async function sessionFor(email) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("No test session");
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession(data.session);
  return [...jar].map(([name, value]) => ({ name, value, domain: new URL(BASE).hostname, path: "/", secure: BASE.startsWith("https") }));
}

async function inspectModal(user, expectedText, filename, viewport) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport });
    await context.addCookies(await sessionFor(user.email));
    const page = await context.newPage();
    await page.goto(`${BASE}/account/settings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Delete my account" }).click();
    try {
      await page.getByText(expectedText, { exact: false }).waitFor({ timeout: 15000 });
    } catch (error) {
      fs.mkdirSync("artifacts", { recursive: true });
      await page.screenshot({ path: `artifacts/${filename}-failure.png`, fullPage: true });
      const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1500);
      throw new Error(`${filename} did not render ${JSON.stringify(expectedText)}: ${visibleText}`, { cause: error });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${filename} renders the correct recovery state without horizontal overflow`, !overflow);
    fs.mkdirSync("artifacts", { recursive: true });
    await page.screenshot({ path: `artifacts/${filename}.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}

const originalFetch = globalThis.fetch;
try {
  const rejectedUser = await createUser("recoverable");
  const phoneOnlyUser = await createUser("phone-only", true);
  const acceptedUser = await createUser("accepted");
  const { error: personalDataError } = await service.from("profiles").update({
    address: "99 Deletion Test Road",
    kyc_status: "verified",
    date_of_birth: "1998-02-03",
    license_issued_on: "2020-01-01",
    license_expires_on: "2030-01-01",
    license_jurisdiction: "sri_lanka",
    license_review_status: "verified",
    license_submitted_at: new Date().toISOString(),
    license_reviewed_at: new Date().toISOString(),
    license_review_note: "Temporary deletion verifier metadata",
  }).eq("id", acceptedUser.id);
  if (personalDataError) throw personalDataError;
  const pageBase = {
    owner_id: acceptedUser.id,
    city: "Colombo",
    whatsapp_number: "+94771234567",
    page_type: "personal",
    is_verified: true,
  };
  const { data: recoveryPages, error: pageError } = await service.from("agencies").insert([
    { ...pageBase, name: `Deletion normal ${stamp}`, slug: `deletion-normal-${stamp}`, is_blocked: false },
    { ...pageBase, name: `Deletion suspended ${stamp}`, slug: `deletion-suspended-${stamp}`, is_blocked: true },
    { ...pageBase, name: `Deletion admin ${stamp}`, slug: `deletion-admin-${stamp}`, is_blocked: false },
    { ...pageBase, name: `Deletion business ${stamp}`, slug: `deletion-business-${stamp}`, page_type: "business", business_reg_no: "TEST-DELETE", is_blocked: false },
  ]).select("id, name");
  if (pageError || !recoveryPages || recoveryPages.length !== 4) throw pageError ?? new Error("Recovery page fixture failed");
  const normalPage = recoveryPages.find((page) => page.name.includes("normal"));
  const suspendedPage = recoveryPages.find((page) => page.name.includes("suspended"));
  const adminPage = recoveryPages.find((page) => page.name.includes("admin"));
  const businessPage = recoveryPages.find((page) => page.name.includes("business"));
  if (!normalPage || !suspendedPage || !adminPage || !businessPage) throw new Error("Recovery page fixture names failed");
  const { error: memberError } = await service.from("agency_members").insert({
    agency_id: adminPage.id,
    user_id: rejectedUser.id,
    role: "manager",
    invited_by: acceptedUser.id,
  });
  if (memberError) throw memberError;
  await softDeleteAgency(adminPage.id, "admin");
  const [{ data: deletedPage }, { count: remainingMembers }] = await Promise.all([
    service.from("agencies").select("deleted_at,deletion_source,deactivated_at,whatsapp_number,email").eq("id", adminPage.id).single(),
    service.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", adminPage.id),
  ]);
  check(
    "page deletion removes contact data, pauses the page, and revokes staff atomically",
    !!deletedPage?.deleted_at
      && deletedPage.deletion_source === "admin"
      && !!deletedPage.deactivated_at
      && deletedPage.whatsapp_number === null
      && deletedPage.email === null
      && remainingMembers === 0,
    JSON.stringify({ deletedPage, remainingMembers }),
  );

  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://api.resend.com/")) {
      return new Response("rejected for deletion verification", { status: 500, statusText: "Rejected" });
    }
    return originalFetch(input, init);
  };
  let rejected = false;
  let rejectionName = "none";
  try {
    await softDeleteUser(rejectedUser.id);
  } catch (error) {
    rejectionName = error instanceof Error ? error.name : typeof error;
    rejected = error instanceof RecoveryEmailDeliveryError || rejectionName === "RecoveryEmailDeliveryError";
  }
  const { data: unchanged } = await service.from("profiles").select("full_name,deleted_at").eq("id", rejectedUser.id).single();
  check(
    "a rejected recovery email stops deletion before the profile changes",
    rejected && unchanged?.full_name === "Deletion recoverable" && !unchanged?.deleted_at,
    JSON.stringify({ rejected, rejectionName, unchanged }),
  );

  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://api.resend.com/")) {
      return new Response(JSON.stringify({ id: "deletion-email-check" }), { status: 200 });
    }
    return originalFetch(input, init);
  };
  await softDeleteUser(acceptedUser.id);
  const { data: deleted } = await service.from("profiles")
    .select("full_name,email,address,deleted_at,kyc_status,date_of_birth,license_issued_on,license_expires_on,license_jurisdiction,license_review_status,license_submitted_at,license_reviewed_at,license_review_note")
    .eq("id", acceptedUser.id).single();
  check(
    "an accepted recovery email atomically scrubs profile, address, identity state, and licence metadata",
    !!deleted?.deleted_at
      && deleted.email === null
      && deleted.address === null
      && deleted.full_name?.startsWith("Deleted user #")
      && deleted.kyc_status === "unverified"
      && deleted.date_of_birth === null
      && deleted.license_issued_on === null
      && deleted.license_expires_on === null
      && deleted.license_jurisdiction === null
      && deleted.license_review_status === "not_submitted"
      && deleted.license_submitted_at === null
      && deleted.license_reviewed_at === null
      && deleted.license_review_note === null,
    JSON.stringify(deleted),
  );
  const { data: accountDeletedPages } = await service.from("agencies")
    .select("id,name,page_type,is_verified,deleted_at,deletion_source,deactivated_at,whatsapp_number,email")
    .in("id", [normalPage.id, suspendedPage.id, businessPage.id]);
  check(
    "all live Rental Pages owned by the deleted account are hidden and scrubbed in the same operation",
    accountDeletedPages?.length === 3
      && accountDeletedPages.every((page) => !!page.deleted_at
        && page.deletion_source === "account"
        && !!page.deactivated_at
        && page.name.startsWith("Former Rental Page #")
        && page.whatsapp_number === null
        && page.email === null)
      && accountDeletedPages.find((page) => page.id === businessPage.id)?.is_verified === false,
    JSON.stringify(accountDeletedPages),
  );
  await restoreOwnedPages(acceptedUser.id);
  const { data: restoredPages } = await service.from("agencies").select("id,is_verified,is_blocked,deactivated_at,deleted_at,deletion_source").in("id", [normalPage.id, suspendedPage.id, adminPage.id, businessPage.id]);
  const restoredNormal = restoredPages?.find((page) => page.id === normalPage.id);
  const restoredSuspended = restoredPages?.find((page) => page.id === suspendedPage.id);
  const retainedAdminDeletion = restoredPages?.find((page) => page.id === adminPage.id);
  const restoredBusiness = restoredPages?.find((page) => page.id === businessPage.id);
  check("ordinary account-deleted page can be restored without inventing a suspension", restoredNormal?.deleted_at === null && restoredNormal?.is_blocked === false);
  check("account recovery preserves a page suspension that existed before deletion", restoredSuspended?.deleted_at === null && restoredSuspended?.is_blocked === true);
  check("account recovery cannot revive an admin-deleted Rental Page", !!retainedAdminDeletion?.deleted_at && retainedAdminDeletion?.deletion_source === "admin");
  check("a restored business page must pass business verification again", restoredBusiness?.deleted_at === null && restoredBusiness?.is_verified === false && !!restoredBusiness?.deactivated_at);

  const { error: restoredDetailsError } = await service.from("agencies").update({
    name: "Restored personal page for eligibility check",
    whatsapp_number: "+94779999999",
  }).eq("id", normalPage.id);
  if (restoredDetailsError) throw restoredDetailsError;
  const { error: restoredPhoneError } = await service.from("agencies").update({ whatsapp_verified_at: new Date().toISOString() }).eq("id", normalPage.id);
  if (restoredPhoneError) throw restoredPhoneError;
  const { error: resumeError } = await service.rpc("set_rental_page_active", {
    p_agency_id: normalPage.id,
    p_owner_id: acceptedUser.id,
    p_active: true,
  });
  const { data: stillPaused } = await service.from("agencies").select("name,is_verified,deactivated_at,whatsapp_number,whatsapp_verified_at").eq("id", normalPage.id).single();
  check(
    "a restored owner must redo identity verification before a personal Rental Page can resume",
    resumeError?.message.includes("identity verification") === true
      && !!stillPaused?.deactivated_at
      && stillPaused.is_verified === true
      && stillPaused.name === "Restored personal page for eligibility check"
      && stillPaused.whatsapp_number === "+94779999999"
      && !!stillPaused.whatsapp_verified_at,
    JSON.stringify({ error: resumeError?.message, stillPaused }),
  );

  globalThis.fetch = originalFetch;
  await inspectModal(rejectedUser, "email a recovery link before deleting anything", "account-deletion-recoverable-desktop", { width: 1440, height: 1000 });
  await inspectModal(phoneOnlyUser, "no usable email for a recovery link", "account-deletion-permanent-mobile", { width: 390, height: 844 });

  console.log(`\n${passed} account-deletion safety and UI checks passed.`);
} finally {
  globalThis.fetch = originalFetch;
  for (const userId of createdUsers) {
    await service.auth.admin.deleteUser(userId).catch(() => {});
  }
}
