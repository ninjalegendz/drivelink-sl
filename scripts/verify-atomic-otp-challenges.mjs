#!/usr/bin/env node

// Exercises the OTP functions directly, including concurrent requests. Every
// temporary challenge is removed at the end, even if a check fails.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const connection = { connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
const client = new pg.Client(connection);
const subjects = [
  `test:atomic-otp:${randomUUID()}`,
  `test:atomic-otp:${randomUUID()}`,
];
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function call(clientToUse, functionName, args) {
  const params = Object.values(args);
  const result = await clientToUse.query(
    `select public.${functionName}($1, $2, $3) as result`,
    params,
  );
  return result.rows[0]?.result;
}

await client.connect();
try {
  const model = await client.query(`
    select
      to_regclass('public.otp_challenges') is not null as table_exists,
      to_regprocedure('public.issue_otp_challenge(text,text,text)') is not null as issue_function,
      to_regprocedure('public.verify_otp_challenge(text,text,text)') is not null as verify_function
  `);
  check("atomic OTP storage and functions are present", Object.values(model.rows[0] ?? {}).every(Boolean), JSON.stringify(model.rows[0]));

  const grants = await client.query(`
    select
      has_table_privilege('authenticated', 'public.otp_challenges', 'select') as table_read,
      has_function_privilege('authenticated', 'public.issue_otp_challenge(text,text,text)', 'EXECUTE') as issue_authenticated,
      has_function_privilege('authenticated', 'public.verify_otp_challenge(text,text,text)', 'EXECUTE') as verify_authenticated
  `);
  check("browser accounts cannot read or operate OTP challenges directly", Object.values(grants.rows[0] ?? {}).every((value) => value === false), JSON.stringify(grants.rows[0]));

  const [firstClient, secondClient] = [new pg.Client(connection), new pg.Client(connection)];
  await Promise.all([firstClient.connect(), secondClient.connect()]);
  try {
    const [firstIssue, secondIssue] = await Promise.all([
      call(firstClient, "issue_otp_challenge", { subject: subjects[0], purpose: "login", hash: "a".repeat(64) }),
      call(secondClient, "issue_otp_challenge", { subject: subjects[0], purpose: "login", hash: "b".repeat(64) }),
    ]);
    const issued = [firstIssue, secondIssue];
    check(
      "two simultaneous first sends create only one usable challenge",
      issued.filter((row) => row?.ok === true).length === 1
        && issued.filter((row) => row?.reason === "cooldown").length === 1,
      JSON.stringify(issued),
    );

    const current = await client.query(
      "select code_hash, send_count from public.otp_challenges where subject_key=$1 and purpose='login'",
      [subjects[0]],
    );
    check("the winning send leaves one first-send record", current.rowCount === 1 && current.rows[0]?.send_count === 1, JSON.stringify(current.rows[0]));

    const winningHash = current.rows[0]?.code_hash;
    const [firstVerify, secondVerify] = await Promise.all([
      call(firstClient, "verify_otp_challenge", { subject: subjects[0], purpose: "login", hash: winningHash }),
      call(secondClient, "verify_otp_challenge", { subject: subjects[0], purpose: "login", hash: winningHash }),
    ]);
    const verified = [firstVerify, secondVerify];
    check(
      "two simultaneous correct-code checks can consume it only once",
      verified.filter((row) => row?.ok === true).length === 1
        && verified.filter((row) => row?.reason === "already_used").length === 1,
      JSON.stringify(verified),
    );
  } finally {
    await Promise.all([firstClient.end(), secondClient.end()]);
  }

  const first = await call(client, "issue_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "c".repeat(64) });
  check("a fresh challenge is issued with the normal resend period", first?.ok === true && first?.next_cooldown_sec === 60, JSON.stringify(first));

  // Simulates time passing without sleeping, then replaces a code. The old
  // code must not be accepted merely because it was correct when first read.
  await client.query(
    "update public.otp_challenges set last_sent_at = now() - interval '2 minutes' where subject_key=$1 and purpose='signup'",
    [subjects[1]],
  );
  const replacement = await call(client, "issue_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "d".repeat(64) });
  const oldCode = await call(client, "verify_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "c".repeat(64) });
  check(
    "a replaced code is rejected against the current stored code",
    replacement?.ok === true && oldCode?.reason === "invalid_code" && oldCode?.attempts_left === 4,
    JSON.stringify({ replacement, oldCode }),
  );

  const currentCode = await call(client, "verify_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "d".repeat(64) });
  check("the replacement code remains valid after a counted wrong guess", currentCode?.ok === true, JSON.stringify(currentCode));

  await client.query(
    "update public.otp_challenges set last_sent_at = now() - interval '2 minutes' where subject_key=$1 and purpose='signup'",
    [subjects[1]],
  );
  await call(client, "issue_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "e".repeat(64) });
  const wrongResults = [];
  for (let index = 0; index < 5; index += 1) {
    wrongResults.push(await call(client, "verify_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "f".repeat(64) }));
  }
  const locked = await call(client, "verify_otp_challenge", { subject: subjects[1], purpose: "signup", hash: "e".repeat(64) });
  check(
    "five wrong guesses lock the current code for that attempt window",
    wrongResults.at(-1)?.attempts_left === 0 && locked?.reason === "too_many_attempts",
    JSON.stringify({ wrongResults, locked }),
  );

  console.log(`\n${passed} atomic OTP checks passed (temporary records removed).`);
} finally {
  await client.query("delete from public.otp_challenges where subject_key = any($1::text[])", [subjects]);
  await client.end();
}
