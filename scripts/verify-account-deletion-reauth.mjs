#!/usr/bin/env node

// Rollback-only check for the fresh, single-use deletion confirmation rule.

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
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

await client.connect();
try {
  await client.query("begin");
  const profile = await client.query("select id from public.profiles where deleted_at is null limit 1");
  const userId = profile.rows[0]?.id;
  if (!userId) throw new Error("An active profile is required for the deletion reauthentication verifier.");

  const model = await client.query(`
    select
      to_regprocedure('public.issue_account_action_challenge(uuid,text,text)') is not null as issue_function,
      to_regprocedure('public.verify_account_action_challenge(uuid,text,boolean)') is not null as verify_function,
      to_regprocedure('public.redeem_account_action_challenge(uuid,text)') is not null as redeem_function
  `);
  check("deletion confirmation functions are present", Object.values(model.rows[0] ?? {}).every(Boolean), JSON.stringify(model.rows[0]));

  await client.query("delete from public.account_action_challenges where user_id=$1 and purpose='account_delete'", [userId]);
  const issued = await client.query("select public.issue_account_action_challenge($1,'account_delete','known-hash') as result", [userId]);
  check("a new deletion code is short-lived and has a resend cooldown", issued.rows[0]?.result?.ok === true && issued.rows[0]?.result?.next_cooldown_sec === 60, JSON.stringify(issued.rows[0]?.result));

  const beforeVerify = await client.query("select public.redeem_account_action_challenge($1,'account_delete') as redeemed", [userId]);
  check("a session cannot redeem deletion without a fresh code", beforeVerify.rows[0]?.redeemed === false);

  const wrong = await client.query("select public.verify_account_action_challenge($1,'account_delete',false) as result", [userId]);
  check("a wrong code is counted atomically", wrong.rows[0]?.result?.reason === "invalid_code" && wrong.rows[0]?.result?.attempts_left === 4, JSON.stringify(wrong.rows[0]?.result));

  const verified = await client.query("select public.verify_account_action_challenge($1,'account_delete',true) as result", [userId]);
  check("a valid fresh code creates a brief deletion window", verified.rows[0]?.result?.ok === true, JSON.stringify(verified.rows[0]?.result));

  const redeemed = await client.query("select public.redeem_account_action_challenge($1,'account_delete') as redeemed", [userId]);
  const replay = await client.query("select public.redeem_account_action_challenge($1,'account_delete') as redeemed", [userId]);
  check("a verified code can be redeemed exactly once", redeemed.rows[0]?.redeemed === true && replay.rows[0]?.redeemed === false);

  const grants = await client.query(`
    select
      has_function_privilege('authenticated', 'public.issue_account_action_challenge(uuid,text,text)', 'EXECUTE') as issue_authenticated,
      has_function_privilege('authenticated', 'public.verify_account_action_challenge(uuid,text,boolean)', 'EXECUTE') as verify_authenticated,
      has_function_privilege('authenticated', 'public.redeem_account_action_challenge(uuid,text)', 'EXECUTE') as redeem_authenticated
  `);
  check("only trusted server code can use the deletion challenge functions", Object.values(grants.rows[0] ?? {}).every((value) => value === false), JSON.stringify(grants.rows[0]));

  console.log(`\n${passed} account-deletion reauthentication checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
