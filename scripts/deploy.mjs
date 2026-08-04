#!/usr/bin/env node
/*
 * Production deploy, pinned to the DriveLink Cloudflare account.
 *
 * Why this exists: `wrangler` keeps ONE OAuth login per machine, so signing
 * into another Cloudflare account from any other project silently repoints
 * DriveLink deploys. That has already caused a deploy to fail outright and,
 * worse, a deploy that landed in the wrong account. This wrapper:
 *
 *   1. loads CLOUDFLARE_API_TOKEN from .env.local (gitignored),
 *   2. asserts the token really resolves to the DriveLink account,
 *   3. only then runs the deploy.
 *
 * Uses `wrangler deploy` rather than `opennextjs-cloudflare deploy` because
 * the latter's populateCache step intermittently times out against R2.
 * Build first (`npm run cf:build`) — this script only uploads.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Resolve npx directly rather than going through a shell — passing args with
// `shell: true` is deprecated (and unescaped) on Node 22+.
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

const EXPECTED_ACCOUNT = "drivelink.support@gmail.com";
const ENV_FILE = ".env.local";

function loadToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  if (!existsSync(ENV_FILE)) return null;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return null;
}

function fail(msg) {
  console.error(`\n[deploy] ${msg}\n`);
  process.exit(1);
}

const token = loadToken();
if (!token) {
  fail(
    `No CLOUDFLARE_API_TOKEN found.\n` +
    `        Add it to ${ENV_FILE}:  CLOUDFLARE_API_TOKEN=...\n` +
    `        Create one at: Cloudflare dashboard > My Profile > API Tokens > Edit Cloudflare Workers`
  );
}

const env = { ...process.env, CLOUDFLARE_API_TOKEN: token, OPEN_NEXT_DEPLOY: "true" };
// Make sure a stale machine-wide OAuth login can't win over the token.
delete env.CLOUDFLARE_API_KEY;
delete env.CLOUDFLARE_EMAIL;

// Guard: confirm the token points at DriveLink before uploading anything.
const who = spawnSync(NPX, ["wrangler", "whoami"], { env, encoding: "utf8" });
const whoOut = `${who.stdout ?? ""}${who.stderr ?? ""}`;
if (!whoOut.includes(EXPECTED_ACCOUNT)) {
  fail(
    `Refusing to deploy: token does not resolve to ${EXPECTED_ACCOUNT}.\n` +
    `        wrangler reported:\n${whoOut.split("\n").slice(0, 6).map((l) => "        " + l).join("\n")}`
  );
}
console.log(`[deploy] account verified: ${EXPECTED_ACCOUNT}`);

const res = spawnSync(NPX, ["wrangler", "deploy"], { env, stdio: "inherit" });
process.exit(res.status ?? 1);
