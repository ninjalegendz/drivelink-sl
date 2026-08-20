#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

function loadEnv() {
  return Object.fromEntries(
    fs.readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/verify-migration.mjs <path-to-.sql>");

const env = loadEnv();
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync(file, "utf8"));
  console.log(`PASS ${file} compiles inside a rollback-only transaction`);
} finally {
  await client.query("rollback");
  await client.end();
}
