#!/usr/bin/env node
// Deploys the independent monitor with the same controlled account guard used
// by the main release. Secrets are read locally and streamed to Wrangler; they
// are never written to the repository or printed.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = resolve(root, "monitor-worker/wrangler.jsonc");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const expectedAccount = "drivelink.support@gmail.com";

function loadEnv() {
  const env = { ...process.env };
  const file = resolve(root, ".env.local");
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^(?:"|')|(?:"|')$/g, "");
  }
  return env;
}

const env = loadEnv();
const needed = ["CLOUDFLARE_API_TOKEN", "CRON_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL"];
for (const key of needed) {
  if (!env[key]) throw new Error(`[operations monitor] ${key} is missing from .env.local.`);
}

function run(args, input) {
  return spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    env: { ...env, OPEN_NEXT_DEPLOY: "true" },
    input,
    encoding: "utf8",
    stdio: input === undefined ? "pipe" : ["pipe", "pipe", "pipe"],
  });
}

const who = run(["whoami"]);
const whoOutput = `${who.stdout ?? ""}${who.stderr ?? ""}`;
if (who.status !== 0 || !whoOutput.includes(expectedAccount)) {
  throw new Error(`[operations monitor] refusing to deploy outside ${expectedAccount}.`);
}

for (const key of ["CRON_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_FROM_NAME"]) {
  if (!env[key]) continue;
  const result = run(["secret", "put", key, "--config", config], `${env[key]}\n`);
  if (result.status !== 0) {
    throw new Error(`[operations monitor] could not update ${key}: ${result.stderr || result.stdout}`);
  }
}

const deployment = run(["deploy", "--config", config]);
process.stdout.write(deployment.stdout ?? "");
process.stderr.write(deployment.stderr ?? "");
if (deployment.status !== 0) process.exit(deployment.status ?? 1);
