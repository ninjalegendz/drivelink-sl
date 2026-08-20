#!/usr/bin/env node

// Exercises the connection-fingerprint throttle directly. Every record uses a
// random fake fingerprint and is removed in the final cleanup.

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const connection = { connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
const fingerprints = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function consume(client, keyHash, maxRequests = 3, windowSeconds = 900) {
  const result = await client.query(
    "select public.consume_auth_request_limit($1, $2, $3, $4) as result",
    ["auth_start_ip", keyHash, maxRequests, windowSeconds],
  );
  return result.rows[0]?.result;
}

const client = new pg.Client(connection);
await client.connect();
try {
  const model = await client.query(`
    select
      to_regclass('public.auth_request_limits') is not null as table_exists,
      to_regprocedure('public.consume_auth_request_limit(text,text,integer,integer)') is not null as function_exists
  `);
  check("connection-level auth limit storage and function are present", Object.values(model.rows[0] ?? {}).every(Boolean), JSON.stringify(model.rows[0]));

  const grants = await client.query(`
    select
      has_table_privilege('authenticated', 'public.auth_request_limits', 'select') as table_read,
      has_function_privilege('authenticated', 'public.consume_auth_request_limit(text,text,integer,integer)', 'execute') as function_execute
  `);
  check("browser accounts cannot inspect or consume connection limits directly", Object.values(grants.rows[0] ?? {}).every((value) => value === false), JSON.stringify(grants.rows[0]));

  const one = await consume(client, fingerprints[0]);
  const two = await consume(client, fingerprints[0]);
  const three = await consume(client, fingerprints[0]);
  const blocked = await consume(client, fingerprints[0]);
  check(
    "one connection receives only the configured number of starts per window",
    one?.allowed === true && two?.allowed === true && three?.allowed === true && blocked?.allowed === false && blocked?.retry_after_sec > 0,
    JSON.stringify({ one, two, three, blocked }),
  );

  const separate = await consume(client, fingerprints[1]);
  check("a different connection fingerprint has its own allowance", separate?.allowed === true, JSON.stringify(separate));

  await client.query(
    "update public.auth_request_limits set window_started_at = now() - interval '16 minutes' where scope='auth_start_ip' and key_hash=$1",
    [fingerprints[0]],
  );
  const renewed = await consume(client, fingerprints[0]);
  check("an expired window renews the allowance", renewed?.allowed === true && renewed?.remaining === 2, JSON.stringify(renewed));

  const [firstClient, secondClient] = [new pg.Client(connection), new pg.Client(connection)];
  await Promise.all([firstClient.connect(), secondClient.connect()]);
  try {
    const parallelKey = randomBytes(32).toString("hex");
    fingerprints.push(parallelKey);
    const results = await Promise.all([
      consume(firstClient, parallelKey, 1),
      consume(secondClient, parallelKey, 1),
    ]);
    check(
      "two simultaneous first requests cannot both pass a one-request window",
      results.filter((result) => result?.allowed === true).length === 1
        && results.filter((result) => result?.allowed === false).length === 1,
      JSON.stringify(results),
    );
  } finally {
    await Promise.all([firstClient.end(), secondClient.end()]);
  }

  console.log(`\n${passed} connection-level auth limit checks passed (temporary records removed).`);
} finally {
  await client.query(
    "delete from public.auth_request_limits where scope='auth_start_ip' and key_hash = any($1::text[])",
    [fingerprints],
  );
  await client.end();
}
