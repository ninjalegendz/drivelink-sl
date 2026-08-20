#!/usr/bin/env node

// Rollback-only database checks for two-sided Rental Page team invitations.

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
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
  } finally { await client.query(`release savepoint ${savepoint}`); }
}

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync("supabase/migrations/095_team_invitations.sql", "utf8"));
  check("team-invitation migration compiles cleanly over the live schema", true);

  const seedResult = await client.query(`
    select a.id as agency_id, a.owner_id, b.renter_id as invitee_id
    from public.bookings b join public.agencies a on a.id = b.agency_id
    where b.renter_id <> a.owner_id
    order by b.created_at desc
    limit 1
  `);
  const seed = seedResult.rows[0];
  if (!seed) throw new Error("No owner/invitee relationship is available for verification.");
  await client.query("delete from public.agency_member_access_events where agency_id=$1 and subject_user_id=$2", [seed.agency_id, seed.invitee_id]);
  await client.query("delete from public.agency_member_invitations where agency_id=$1 and invitee_id=$2", [seed.agency_id, seed.invitee_id]);
  await client.query("delete from public.agency_members where agency_id=$1 and user_id=$2", [seed.agency_id, seed.invitee_id]);

  await expectError("a non-owner cannot create a team invitation", "select public.create_agency_member_invitation($1,$2,$3,$4)", [seed.agency_id, seed.invitee_id, seed.invitee_id, "team-check@example.com"]);
  const invited = await client.query("select public.create_agency_member_invitation($1,$2,$3,$4) as result", [seed.agency_id, seed.owner_id, seed.invitee_id, "team-check@example.com"]);
  const invitationId = invited.rows[0].result.id;
  const activeBefore = await client.query("select count(*)::int as count from public.agency_members where agency_id=$1 and user_id=$2", [seed.agency_id, seed.invitee_id]);
  check("creating an invitation does not create active staff access", activeBefore.rows[0].count === 0);
  await expectError("a different account cannot accept the invitation", "select public.respond_to_agency_member_invitation($1,$2,'accept')", [invitationId, seed.owner_id]);
  const accepted = await client.query("select public.respond_to_agency_member_invitation($1,$2,'accept') as result", [invitationId, seed.invitee_id]);
  check("only the invited account can accept and activate staff access", accepted.rows[0].result.status === "accepted");
  const member = await client.query("select can_view_renter_documents from public.agency_members where agency_id=$1 and user_id=$2", [seed.agency_id, seed.invitee_id]);
  check("newly accepted staff do not receive renter-document access by default", member.rows[0]?.can_view_renter_documents === false);
  const events = await client.query("select event_type from public.agency_member_access_events where invitation_id=$1 order by created_at", [invitationId]);
  check("invite and acceptance are kept in the access audit history", events.rows.map((row) => row.event_type).join(",") === "invited,accepted", JSON.stringify(events.rows));
  const removal = await client.query("select public.remove_agency_member($1,$2,$3) as result", [seed.agency_id, seed.owner_id, seed.invitee_id]);
  check("removing staff immediately removes active access", removal.rows[0].result.ok === true);
  const removalEvent = await client.query("select metadata->>'removed_by_self' as removed_by_self from public.agency_member_access_events where agency_id=$1 and subject_user_id=$2 and event_type='removed' order by created_at desc limit 1", [seed.agency_id, seed.invitee_id]);
  check("staff removal is recorded in the same database action", removalEvent.rows[0]?.removed_by_self === "false");

  const expired = await client.query(`
    insert into public.agency_member_invitations (agency_id, invitee_id, invited_by, invited_email, expires_at)
    values ($1,$2,$3,'expired-check@example.com',now()-interval '1 minute') returning id
  `, [seed.agency_id, seed.invitee_id, seed.owner_id]);
  const expiredResponse = await client.query("select public.respond_to_agency_member_invitation($1,$2,'accept') as result", [expired.rows[0].id, seed.invitee_id]);
  check("an expired invitation stays expired when the invitee tries to accept", expiredResponse.rows[0].result.status === "expired");
  const expiredEvent = await client.query("select count(*)::int as count from public.agency_member_access_events where invitation_id=$1 and event_type='expired'", [expired.rows[0].id]);
  check("an expired acceptance attempt is kept in the access audit history", expiredEvent.rows[0].count === 1);

  const scheduledExpired = await client.query(`
    insert into public.agency_member_invitations (agency_id, invitee_id, invited_by, invited_email, expires_at)
    values ($1,$2,$3,'scheduled-expired-check@example.com',now()-interval '1 minute') returning id
  `, [seed.agency_id, seed.invitee_id, seed.owner_id]);
  const expiredCount = await client.query("select public.expire_agency_member_invitations() as count");
  const expiredState = await client.query("select status from public.agency_member_invitations where id=$1", [scheduledExpired.rows[0].id]);
  check("the scheduled expiry routine removes stale pending invitations", expiredCount.rows[0].count >= 1 && expiredState.rows[0].status === "expired", JSON.stringify({ count: expiredCount.rows[0].count, status: expiredState.rows[0].status }));

  console.log(`\n${passed} team-invitation checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
