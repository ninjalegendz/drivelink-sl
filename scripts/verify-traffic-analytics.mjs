import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
}));
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

await client.connect();
try {
  await client.query("begin");
  const { rows: tableRows } = await client.query(`
    select relname, relrowsecurity
    from pg_class where relname in ('traffic_sessions', 'traffic_events')
  `);
  check("both analytics tables exist with RLS enabled", tableRows.length === 2 && tableRows.every((row) => row.relrowsecurity));

  const { rows: privileges } = await client.query(`
    select
      has_table_privilege('anon', 'public.traffic_sessions', 'select') as anon_sessions,
      has_table_privilege('authenticated', 'public.traffic_events', 'select') as auth_events,
      has_function_privilege('anon', 'public.record_traffic_event(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb)', 'execute') as anon_record
  `);
  check("browser roles cannot read or call the analytics writer", !privileges[0].anon_sessions && !privileges[0].auth_events && !privileges[0].anon_record);

  const sessionId = crypto.randomUUID();
  await client.query(`select public.record_traffic_event($1, null, 'page_view', '/vehicles', '/vehicles', 'direct', null, null, null, null, 'mobile', 'chrome', 'LK', null, null, '{}'::jsonb)`, [sessionId]);
  await client.query(`select public.record_traffic_event($1, null, 'vehicle_view', '/vehicles/example', '/vehicles', 'direct', null, null, null, null, 'mobile', 'chrome', 'LK', 'vehicle', 'test-vehicle', '{"label":"Test vehicle"}'::jsonb)`, [sessionId]);
  const { rows: stored } = await client.query("select page_view_count from public.traffic_sessions where id = $1", [sessionId]);
  check("the service writer stores a session and page-view count", stored[0]?.page_view_count === 1);

  const { rows: snapshotRows } = await client.query("select public.traffic_analytics_snapshot(now() - interval '1 day') as snapshot");
  const snapshot = snapshotRows[0].snapshot;
  check("snapshot returns live, funnel, source, device and journey sections", ["active_now", "visitors", "sources", "devices", "recent", "top_paths", "top_vehicles"].every((key) => Object.hasOwn(snapshot, key)));

  const { rows: metadata } = await client.query("select metadata from public.traffic_events where session_id = $1 and event_name = 'vehicle_view'", [sessionId]);
  check("event metadata contains only the accepted display label", JSON.stringify(metadata[0]?.metadata) === JSON.stringify({ label: "Test vehicle" }));
} finally {
  await client.query("rollback");
  await client.end();
}

console.log(`\n${passed} traffic analytics security checks passed.`);

