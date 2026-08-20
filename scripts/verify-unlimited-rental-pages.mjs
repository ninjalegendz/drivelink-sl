#!/usr/bin/env node

// Rollback-only database checks for the no-lifetime-cap Rental Page policy.

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

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync("supabase/migrations/096_unlimited_rental_pages.sql", "utf8"));
  check("unlimited-page migration compiles cleanly over the live schema", true);

  const profileResult = await client.query(`
    select id from public.profiles
    where kyc_status = 'verified' and is_blacklisted = false and deleted_at is null
    order by created_at asc limit 1
  `);
  const ownerId = profileResult.rows[0]?.id;
  if (!ownerId) throw new Error("No verified profile is available for page creation verification.");

  for (let index = 1; index <= 5; index += 1) {
    await client.query(`
      insert into public.agencies (owner_id, name, slug, page_type, city, whatsapp_number, email, is_verified, created_at)
      values ($1,$2,$3,'personal','Colombo',$4,$5,true,now()-interval '2 days')
    `, [ownerId, `Old page ${stamp}-${index}`, `old-page-${stamp}-${index}`, `+9477000${String(index).padStart(4, "0")}`, `old-page-${stamp}-${index}@example.invalid`]);
  }
  const created = await client.query(`
    select (public.create_rental_page($1,$2,$3,'personal','Colombo',$4,null,null,$5,null)).id as id
  `, [ownerId, `Sixth page ${stamp}`, `sixth-page-${stamp}`, "+94771111222", `sixth-page-${stamp}@example.invalid`]);
  check("five older pages do not block a sixth lifetime Rental Page", Boolean(created.rows[0]?.id));

  // Make the following burst test independent of whatever legitimate pages
  // this real verified owner has created recently. The surrounding transaction
  // is always rolled back.
  await client.query("update public.agencies set created_at = now() - interval '2 days' where owner_id = $1 and created_at >= now() - interval '24 hours'", [ownerId]);
  for (let index = 1; index <= 10; index += 1) {
    await client.query("select (public.create_rental_page($1,$2,$3,'personal','Colombo',$4,null,null,$5,null)).id as id", [ownerId, `Burst page ${stamp}-${index}`, `burst-page-${stamp}-${index}`, `+9477222${String(index).padStart(4, "0")}`, `burst-page-${stamp}-${index}@example.invalid`]);
  }
  await expectError(
    "the eleventh page in one day is stopped by the atomic anti-spam guard",
    "select public.create_rental_page($1,$2,$3,'personal','Colombo',$4,null,null,$5,null)",
    [ownerId, `Burst page ${stamp}-11`, `burst-page-${stamp}-11`, "+94772229999", `burst-page-${stamp}-11@example.invalid`],
  );

  const grants = await client.query(`
    select has_function_privilege('authenticated', 'public.create_rental_page(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE') as authenticated_can_call,
           has_function_privilege('service_role', 'public.create_rental_page(uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE') as service_can_call
  `);
  check("only trusted server code can run the creation function", grants.rows[0]?.authenticated_can_call === false && grants.rows[0]?.service_can_call === true, JSON.stringify(grants.rows[0]));

  console.log(`\n${passed} unlimited-page checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
