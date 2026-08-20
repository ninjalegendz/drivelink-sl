#!/usr/bin/env node

// Self-cleaning check of the deployed two-sided team invitation routes. It
// uses unreachable .invalid test email addresses and clears every fixture.

import fs from "node:fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const PASSWORD = "Team-invitation-verify-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const created = { users: [], agencyId: null };
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function createUser(label) {
  const email = `team-invitation-${label}-${stamp}@example.invalid`;
  const phone = `+947${String(Date.now() + created.users.length).slice(-8)}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Team invitation ${label}`, phone },
  });
  if (error || !data.user) throw error ?? new Error("No test user was created.");
  created.users.push(data.user.id);
  return { id: data.user.id, email };
}

async function waitForProfiles(ids) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await service.from("profiles").select("id").in("id", ids);
    if (error) throw error;
    if ((data ?? []).length === ids.length) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for test profiles.");
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

async function request(cookie, method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

async function cleanup() {
  if (created.agencyId) await service.from("agencies").delete().eq("id", created.agencyId);
  for (const userId of created.users) await service.auth.admin.deleteUser(userId);
}

try {
  // Profile phones are unique in the live schema. Create serially so the
  // test's timestamp-derived fixture numbers cannot collide in the same tick.
  const owner = await createUser("owner");
  const invitee = await createUser("invitee");
  const stranger = await createUser("stranger");
  await waitForProfiles([owner.id, invitee.id, stranger.id]);

  // Keep this route test inside DriveLink only: no email is handed to a live
  // delivery service, while the in-account invitation still exists.
  await Promise.all([owner, invitee, stranger].map(({ id, email }, index) => service.from("profiles").update({ email, email_verified_at: null, phone: " ".repeat(20 + index) }).eq("id", id)));
  const { data: page, error: pageError } = await service.from("agencies").insert({
    owner_id: owner.id,
    name: `Team invitation route test ${stamp}`,
    city: "Colombo",
    whatsapp_number: "+94700000002",
    page_type: "personal",
    is_verified: true,
  }).select("id").single();
  if (pageError || !page) throw pageError ?? new Error("No test Rental Page was created.");
  created.agencyId = page.id;

  const [ownerCookie, inviteeCookie, strangerCookie] = await Promise.all([sessionHeader(owner.email), sessionHeader(invitee.email), sessionHeader(stranger.email)]);
  const invited = await request(ownerCookie, "POST", `/api/pages/${page.id}/members`, { email: invitee.email });
  check("owner can create a pending staff invitation", invited.status === 201 && !!invited.json.invitation?.id, JSON.stringify(invited.json));
  const invitationId = invited.json.invitation.id;

  const beforeAccept = await service.from("agency_members").select("user_id").eq("agency_id", page.id).eq("user_id", invitee.id);
  check("pending invitation grants no active staff access", !beforeAccept.error && beforeAccept.data?.length === 0, JSON.stringify(beforeAccept));

  const strangerAccept = await request(strangerCookie, "POST", `/api/account/team-invitations/${invitationId}`, { action: "accept" });
  check("a different signed-in person cannot accept the invitation", strangerAccept.status === 403, JSON.stringify(strangerAccept.json));

  const accepted = await request(inviteeCookie, "POST", `/api/account/team-invitations/${invitationId}`, { action: "accept" });
  check("the invited account can accept its own invitation", accepted.status === 200 && accepted.json.status === "accepted", JSON.stringify(accepted.json));
  const member = await service.from("agency_members").select("can_view_renter_documents").eq("agency_id", page.id).eq("user_id", invitee.id).maybeSingle();
  check("accepted staff start without renter-document access", member.data?.can_view_renter_documents === false, JSON.stringify(member));

  const pageSwitch = await request(inviteeCookie, "POST", "/api/pages/switch", { page_id: page.id });
  check("accepted staff can switch into their assigned Rental Page", pageSwitch.status === 200, JSON.stringify(pageSwitch.json));

  const secondInvite = await request(ownerCookie, "POST", `/api/pages/${page.id}/members`, { email: stranger.email });
  check("owner can create another pending invitation", secondInvite.status === 201 && !!secondInvite.json.invitation?.id, JSON.stringify(secondInvite.json));
  const cancelled = await request(ownerCookie, "DELETE", `/api/pages/${page.id}/invitations/${secondInvite.json.invitation.id}`);
  check("owner can cancel a pending invitation before it grants access", cancelled.status === 200, JSON.stringify(cancelled.json));
  const cancelledAccept = await request(strangerCookie, "POST", `/api/account/team-invitations/${secondInvite.json.invitation.id}`, { action: "accept" });
  check("a cancelled invitation cannot be accepted", cancelledAccept.status === 409, JSON.stringify(cancelledAccept.json));

  const removed = await request(ownerCookie, "DELETE", `/api/pages/${page.id}/members/${invitee.id}`);
  check("owner can remove an active staff member", removed.status === 200, JSON.stringify(removed.json));
  const afterRemoval = await service.from("agency_members").select("user_id").eq("agency_id", page.id).eq("user_id", invitee.id);
  const removalAudit = await service.from("agency_member_access_events").select("event_type").eq("agency_id", page.id).eq("subject_user_id", invitee.id).eq("event_type", "removed").maybeSingle();
  check("removed staff lose access and the removal is auditable", afterRemoval.data?.length === 0 && removalAudit.data?.event_type === "removed", JSON.stringify({ afterRemoval, removalAudit }));

  console.log(`\n${passed} deployed team-invitation route checks passed.`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("cleanup", error instanceof Error ? error.message : error));
}
