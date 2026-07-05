// Apply a SQL migration file directly to the Supabase Postgres database.
//
// Usage:
//   node scripts/migrate.mjs supabase/migrations/040_vehicle_documents.sql
//
// Reads SUPABASE_DB_URL from .env.local (Supabase dashboard → Project Settings
// → Database → Connection string → URI). This is the fallback path when the
// Supabase MCP isn't connected. Migrations are written idempotently, so
// re-running a file is safe.
import pg from "pg";
import fs from "fs";

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/migrate.mjs <path-to-.sql>");
  process.exit(1);
}

const env = loadEnv();
const connectionString = env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`✓ Applied ${file}`);
} catch (err) {
  console.error(`✗ Failed to apply ${file}:`, err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
