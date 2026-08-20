#!/usr/bin/env node

// Rollback-only checks for the durable full-pack queue. It proves that two
// workers cannot claim the same pack, stalled work can recover, and summaries
// keep their immediate-download history semantics.

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

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync("supabase/migrations/094_async_evidence_exports.sql", "utf8"));
  check("queue migration compiles cleanly over the live schema", true);

  const relation = await client.query(`
    select b.id as booking_id, a.owner_id
    from public.bookings b join public.agencies a on a.id = b.agency_id
    where b.renter_id <> a.owner_id
    order by b.created_at desc
    limit 1
  `);
  const seed = relation.rows[0];
  if (!seed) throw new Error("No booking/page relationship is available for verification.");

  const summary = await client.query(`
    insert into public.evidence_exports (booking_id, exported_by, export_kind, reason)
    values ($1, $2, 'summary', 'Immediate summary verification')
    returning preparation_status
  `, [seed.booking_id, seed.owner_id]);
  check("existing immediate summaries remain marked as downloaded", summary.rows[0].preparation_status === "downloaded");

  const queued = await client.query(`
    insert into public.evidence_exports (booking_id, exported_by, export_kind, reason, preparation_status)
    values ($1, $2, 'full', 'Preparing a bounded private case pack', 'queued')
    returning id
  `, [seed.booking_id, seed.owner_id]);
  const exportId = queued.rows[0].id;
  const first = await client.query("select id, preparation_status, attempts from public.claim_evidence_export_jobs($1, 1)", [exportId]);
  check("the private worker atomically claims one queued full pack", first.rows.length === 1 && first.rows[0].id === exportId && first.rows[0].preparation_status === "processing" && first.rows[0].attempts === 1, JSON.stringify(first.rows));
  const duplicate = await client.query("select count(*)::int as count from public.claim_evidence_export_jobs($1, 1)", [exportId]);
  check("a second worker cannot claim the same active pack", duplicate.rows[0].count === 0);

  await client.query("update public.evidence_exports set claimed_at = now() - interval '21 minutes' where id = $1", [exportId]);
  const recovered = await client.query("select id, preparation_status, attempts from public.claim_evidence_export_jobs(null, 1)");
  check("the scheduled worker can recover a stalled preparation", recovered.rows.length === 1 && recovered.rows[0].id === exportId && recovered.rows[0].attempts === 2, JSON.stringify(recovered.rows));

  await client.query("update public.evidence_exports set attempts = 3, preparation_status = 'queued', next_attempt_at = now() where id = $1", [exportId]);
  const exhausted = await client.query("select count(*)::int as count from public.claim_evidence_export_jobs(null, 1)");
  check("a repeatedly failing pack stops after three attempts instead of looping forever", exhausted.rows[0].count === 0);

  console.log(`\n${passed} evidence-export queue checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
