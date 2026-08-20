#!/usr/bin/env node

// Rollback-only verification of the least-access Rental Page staff model.

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const stamp = Date.now().toString(36);
const phone = `+9477${String(Date.now()).slice(-7)}`;
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function expectError(label, sql, params = []) {
  const savepoint = `expected_${passed + 1}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await client.query(sql, params);
    throw new Error(`Expected failure did not occur: ${label}`);
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    if (error instanceof Error && error.message.startsWith("Expected failure")) throw error;
    check(label, true);
  } finally {
    await client.query(`release savepoint ${savepoint}`);
  }
}

async function asUser(userId) {
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
}

async function capability(pageId, capability) {
  const result = await client.query("select public.has_page_capability($1,$2) as allowed", [pageId, capability]);
  return result.rows[0]?.allowed === true;
}

await client.connect();
try {
  await client.query("begin");
  const deployedCapabilityModel = await client.query(`
    select
      to_regprocedure('public.has_page_capability(uuid,text)') is not null as capability_function,
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'agency_members'
          and policyname = 'Members visible to themselves or page managers'
      ) as member_policy
  `);
  check(
    "staff-capability migration is present in the live schema",
    deployedCapabilityModel.rows[0]?.capability_function === true
      && deployedCapabilityModel.rows[0]?.member_policy === true,
    JSON.stringify(deployedCapabilityModel.rows[0]),
  );

  const profiles = await client.query(`
    select id, email from public.profiles
    where deleted_at is null and is_blacklisted = false and email is not null
    order by created_at asc limit 2
  `);
  const owner = profiles.rows[0];
  const staff = profiles.rows[1];
  if (!owner || !staff) throw new Error("Two active profiles are required for the staff-role verifier.");

  const pageResult = await client.query(`
    insert into public.agencies (owner_id,name,slug,page_type,city,whatsapp_number,email,is_verified,created_at)
    values ($1,$2,$3,'personal','Colombo',$4,$5,true,now()-interval '2 days') returning id
  `, [owner.id, `Role check ${stamp}`, `role-check-${stamp}`, phone, `role-check-${stamp}@example.invalid`]);
  const pageId = pageResult.rows[0].id;

  const invite = await client.query(
    "select public.create_agency_member_invitation($1,$2,$3,$4,$5) as invitation",
    [pageId, owner.id, staff.id, staff.email, "fleet_editor"],
  );
  const invitationId = invite.rows[0].invitation.id;
  const invitationRole = await client.query("select role from public.agency_member_invitations where id=$1", [invitationId]);
  check("an invitation records the chosen work role", invitationRole.rows[0]?.role === "fleet_editor");

  await client.query("insert into public.agency_members (agency_id,user_id,role,can_view_renter_documents) values ($1,$2,'fleet_editor',false)", [pageId, staff.id]);
  await asUser(staff.id);
  check("fleet editors can manage fleet records", await capability(pageId, "manage_fleet"));
  check("fleet editors cannot see booking work", !(await capability(pageId, "view_bookings")));
  check("fleet editors cannot create or change money records", !(await capability(pageId, "manage_financial")));

  await asUser(owner.id);
  await client.query("select public.set_agency_member_role($1,$2,'booking_agent')", [pageId, staff.id]);
  await asUser(staff.id);
  check("booking agents can answer rental requests", await capability(pageId, "manage_booking"));
  check("booking agents cannot edit fleet records", !(await capability(pageId, "manage_fleet")));
  check("booking agents cannot start or complete handovers", !(await capability(pageId, "manage_handover")));

  await asUser(owner.id);
  await client.query("select public.set_agency_member_document_permission($1,$2,true)", [pageId, staff.id]);
  let member = await client.query("select role,can_view_renter_documents from public.agency_members where agency_id=$1 and user_id=$2", [pageId, staff.id]);
  check("document access can be separately granted to an eligible role", member.rows[0]?.role === "booking_agent" && member.rows[0]?.can_view_renter_documents === true);
  await client.query("select public.set_agency_member_role($1,$2,'support_agent')", [pageId, staff.id]);
  member = await client.query("select role,can_view_renter_documents from public.agency_members where agency_id=$1 and user_id=$2", [pageId, staff.id]);
  check("moving to a role that does not need ID files removes document access", member.rows[0]?.role === "support_agent" && member.rows[0]?.can_view_renter_documents === false);
  await expectError(
    "document access cannot be granted to a support-only role",
    "select public.set_agency_member_document_permission($1,$2,true)",
    [pageId, staff.id],
  );

  await asUser(staff.id);
  check("support staff can communicate", await capability(pageId, "communicate"));
  check("support staff cannot file a renter report or a financial case", !(await capability(pageId, "manage_cases")) && !(await capability(pageId, "manage_financial")));
  // Exercise the actual RLS policy under the authenticated database role,
  // not merely the helper. A low-access staff member may read their own row
  // for page switching, but not the owner/team roster.
  await client.query("insert into public.agency_members (agency_id,user_id,role) values ($1,$2,'manager')", [pageId, owner.id]);
  await client.query("set local role authenticated");
  const visibleMembers = await client.query("select user_id from public.agency_members where agency_id=$1", [pageId]);
  await client.query("reset role");
  check("RLS lets a low-access staff member see only their own membership row", visibleMembers.rows.length === 1 && visibleMembers.rows[0]?.user_id === staff.id);
  await asUser(owner.id);
  await client.query("select public.set_agency_member_role($1,$2,'manager')", [pageId, staff.id]);
  await asUser(staff.id);
  check("existing and explicitly chosen managers retain full operational access", (await capability(pageId, "manage_booking")) && (await capability(pageId, "manage_handover")) && (await capability(pageId, "manage_financial")) && (await capability(pageId, "manage_fleet")) && (await capability(pageId, "manage_cases")));

  const grants = await client.query(`
    select
      has_function_privilege('authenticated', 'public.create_agency_member_invitation(uuid,uuid,uuid,text,text)', 'EXECUTE') as invite_authenticated,
      has_function_privilege('service_role', 'public.create_agency_member_invitation(uuid,uuid,uuid,text,text)', 'EXECUTE') as invite_service,
      has_function_privilege('authenticated', 'public.set_agency_member_role(uuid,uuid,text)', 'EXECUTE') as role_authenticated
  `);
  const row = grants.rows[0];
  check("only server code can create invitations while owner sessions may change an existing role", row.invite_authenticated === false && row.invite_service === true && row.role_authenticated === true, JSON.stringify(row));

  console.log(`\n${passed} staff-capability checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
