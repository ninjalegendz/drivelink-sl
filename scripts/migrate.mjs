// Apply and record one DriveLink SQL migration.
//
// Usage:
//   node scripts/migrate.mjs supabase/migrations/122_example.sql
//   node scripts/migrate.mjs --baseline 121
//
// The baseline command is deliberate: migrations 001-121 predate this
// tracker's introduction and were verified as the live release baseline. New
// migrations are executed and checksum-recorded in the same transaction.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) continue;
    const index = value.indexOf("=");
    env[value.slice(0, index).trim()] = value.slice(index + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function migrationIdentity(file) {
  const fileName = path.basename(file);
  const match = fileName.match(/^(\d+)_([a-z0-9_]+)\.sql$/i);
  if (!match) throw new Error("Migration names must look like 122_short_description.sql");
  return { version: Number(match[1]), name: match[2], fileName };
}

const CREATE_TRACKER = `
  create table if not exists public.drivelink_schema_migrations (
    version integer primary key,
    name text not null,
    file_name text not null,
    sha256 text,
    record_type text not null check (record_type in ('baseline', 'applied')),
    applied_at timestamptz not null default clock_timestamp()
  );
  revoke all on public.drivelink_schema_migrations from public, anon, authenticated;
  grant all on public.drivelink_schema_migrations to service_role;
`;

const env = loadEnv();
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is not set in .env.local");
const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

const baselineMode = process.argv[2] === "--baseline";
const file = baselineMode ? null : process.argv[2];
if ((!baselineMode && !file) || (baselineMode && !/^\d+$/.test(process.argv[3] ?? ""))) {
  throw new Error("Usage: node scripts/migrate.mjs <path-to-.sql> OR node scripts/migrate.mjs --baseline <version>");
}

await client.connect();
try {
  await client.query("begin");
  await client.query(CREATE_TRACKER);

  if (baselineMode) {
    const version = Number(process.argv[3]);
    const highestApplied = await client.query(
      "select max(version)::int as version from public.drivelink_schema_migrations",
    );
    if ((highestApplied.rows[0]?.version ?? 0) > version) {
      throw new Error(`Cannot set baseline ${version}; a newer migration is already recorded.`);
    }
    await client.query(
      `insert into public.drivelink_schema_migrations
        (version, name, file_name, sha256, record_type)
       values ($1, $2, $3, null, 'baseline')
       on conflict (version) do update set
         name = excluded.name,
         file_name = excluded.file_name,
         record_type = 'baseline'`,
      [version, `verified_baseline_through_${version}`, `001-${version}`],
    );
    await client.query("commit");
    console.log(`PASS recorded verified DriveLink migration baseline through ${version}`);
  } else {
    const { version, name, fileName } = migrationIdentity(file);
    const sql = fs.readFileSync(file, "utf8");
    const sha256 = crypto.createHash("sha256").update(sql).digest("hex");
    const baseline = await client.query(
      "select max(version)::int as version from public.drivelink_schema_migrations where record_type='baseline'",
    );
    if (version <= (baseline.rows[0]?.version ?? 0)) {
      throw new Error(`Migration ${version} is covered by the verified baseline and must not be replayed.`);
    }
    const existing = await client.query(
      "select sha256, file_name from public.drivelink_schema_migrations where version=$1",
      [version],
    );
    if (existing.rowCount) {
      if (existing.rows[0].sha256 !== sha256) {
        throw new Error(`Migration ${version} was already applied with a different checksum. Never edit an applied migration.`);
      }
      await client.query("rollback");
      console.log(`PASS migration ${version} already applied with matching checksum`);
    } else {
      await client.query(sql);
      await client.query(
        `insert into public.drivelink_schema_migrations
          (version, name, file_name, sha256, record_type)
         values ($1,$2,$3,$4,'applied')`,
        [version, name, fileName, sha256],
      );
      await client.query("commit");
      console.log(`PASS applied and recorded ${fileName}`);
    }
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`FAIL migration: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
