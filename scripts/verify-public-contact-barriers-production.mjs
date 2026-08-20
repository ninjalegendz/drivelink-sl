#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
    }),
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
  const guards = await client.query(`
    select
      to_regprocedure('public.public_text_has_contact_details(text)') is not null as detector,
      to_regclass('public.agencies') is not null as pages,
      to_regclass('public.vehicles') is not null as vehicles,
      to_regclass('public.reviews') is not null as reviews
  `);
  check("public contact detector and protected tables are present", Object.values(guards.rows[0] ?? {}).every(Boolean));

  const leaks = await client.query(`
    select 'Rental Page' as kind, id from public.agencies
    where public.public_text_has_contact_details(name)
       or public.public_text_has_contact_details(description)
       or public.public_text_has_contact_details(business_hours)
    union all
    select 'vehicle', id from public.vehicles
    where public.public_text_has_contact_details(description)
       or public.public_text_has_contact_details(array_to_string(rules, ' '))
    union all
    select 'review', id from public.reviews
    where public.public_text_has_contact_details(comment)
  `);
  check("current public records contain no detected direct-contact leaks", leaks.rowCount === 0, `rows=${leaks.rowCount}`);

  await client.query("begin");
  await client.query("set local role anon");
  await client.query("select id, name from public.agencies limit 1");
  check("anonymous marketplace reads can request only public Rental Page fields", true);
  await client.query("savepoint anon_private_column");
  let anonPrivateDenied = false;
  try {
    await client.query("select whatsapp_number from public.agencies limit 1");
  } catch {
    anonPrivateDenied = true;
    await client.query("rollback to savepoint anon_private_column");
  }
  check("anonymous clients cannot request Rental Page contact fields", anonPrivateDenied);
  await client.query("savepoint anon_vehicle_private_column");
  let anonVehiclePrivateDenied = false;
  try {
    await client.query("select plate_number, vin, engine_number from public.vehicles limit 1");
  } catch {
    anonVehiclePrivateDenied = true;
    await client.query("rollback to savepoint anon_vehicle_private_column");
  }
  check("anonymous clients cannot request private vehicle identifiers", anonVehiclePrivateDenied);
  await client.query("reset role");
  await client.query("rollback");

  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)");
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  const signedInScrape = await client.query("select count(*)::integer as count from public.agencies");
  check(
    "an unrelated signed-in account cannot bulk-read Rental Page rows or contacts",
    signedInScrape.rows[0]?.count === 0,
    `rows=${signedInScrape.rows[0]?.count}`,
  );
  const signedInVehicleScrape = await client.query("select count(*)::integer as count from public.vehicles");
  check(
    "an unrelated signed-in account cannot bulk-read raw vehicle inventory records",
    signedInVehicleScrape.rows[0]?.count === 0,
    `rows=${signedInVehicleScrape.rows[0]?.count}`,
  );
  await client.query("reset role");
  await client.query("rollback");

  await client.query("begin");
  const page = await client.query("select id from public.agencies where deleted_at is null limit 1");
  if (!page.rows[0]?.id) throw new Error("An active Rental Page is required for the direct-write check.");
  await client.query("savepoint blocked_contact");
  let rejected = false;
  try {
    await client.query("update public.agencies set description='Book directly on 077 123 4567' where id=$1", [page.rows[0].id]);
  } catch {
    rejected = true;
    await client.query("rollback to savepoint blocked_contact");
  }
  check("a direct database write cannot add a public phone number", rejected);
  await client.query("rollback");

  console.log(`\n${passed} production public-contact checks passed.`);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
