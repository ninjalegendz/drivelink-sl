#!/usr/bin/env node

import { runOperationsMonitor } from "../monitor-worker/worker.ts";

let passed = 0;
function pass(label) {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  pass(label);
}

function createStore(state = null) {
  let value = state;
  let writes = 0;
  return {
    async get() { return value; },
    async put(_key, next) { value = next; writes += 1; },
    value: () => value,
    writes: () => writes,
  };
}

function healthResponse({ ok, issues = [] }) {
  return new Response(JSON.stringify({ ok, issues }), { status: ok ? 200 : 503 });
}

function createEnv(store) {
  return {
    TARGET_URL: "https://drivelink.lk",
    CRON_SECRET: "monitor-test-secret",
    ALERT_TO_EMAIL: "support@drivelink.lk",
    RESEND_API_KEY: "resend-test-key",
    RESEND_FROM_EMAIL: "alerts@drivelink.lk",
    RESEND_FROM_NAME: "DriveLink",
    MONITOR_STATE: store,
  };
}

function createFetcher(health, { emailOk = true } = {}) {
  let emails = 0;
  return {
    fetcher: async (url) => {
      if (String(url).startsWith("https://api.resend.com/")) {
        emails += 1;
        return new Response("{}", { status: emailOk ? 200 : 500 });
      }
      return health.clone();
    },
    emails: () => emails,
  };
}

const now = Date.UTC(2026, 7, 11, 12, 0, 0);

{
  const store = createStore();
  const fake = createFetcher(healthResponse({ ok: true }));
  const result = await runOperationsMonitor(createEnv(store), fake.fetcher, now);
  check("a healthy app creates no alert", result.healthy && !result.alerted && fake.emails() === 0);
  check("a healthy check stores monitor state", store.writes() === 1 && JSON.parse(store.value()).lastSuccessAt);
}

{
  const store = createStore();
  const fake = createFetcher(healthResponse({ ok: false, issues: ["frequent_cron_stale"] }));
  const first = await runOperationsMonitor(createEnv(store), fake.fetcher, now);
  const second = await runOperationsMonitor(createEnv(store), fake.fetcher, now + 5 * 60_000);
  check("the first unhealthy result sends one alert", !first.healthy && first.alerted);
  check("the same failure is throttled for six hours", !second.alerted && fake.emails() === 1);
}

{
  const store = createStore();
  const first = createFetcher(healthResponse({ ok: false, issues: ["frequent_cron_stale"] }));
  await runOperationsMonitor(createEnv(store), first.fetcher, now);
  const changed = createFetcher(healthResponse({ ok: false, issues: ["notification_delivery_failed"] }));
  const result = await runOperationsMonitor(createEnv(store), changed.fetcher, now + 5 * 60_000);
  check("a different unhealthy condition sends a new alert", result.alerted && changed.emails() === 1);
}

{
  const store = createStore();
  const unhealthy = createFetcher(healthResponse({ ok: false, issues: ["daily_cron_stale"] }));
  await runOperationsMonitor(createEnv(store), unhealthy.fetcher, now);
  const healthy = createFetcher(healthResponse({ ok: true }));
  const result = await runOperationsMonitor(createEnv(store), healthy.fetcher, now + 5 * 60_000);
  check("recovery sends one recovery email and clears the active alert", result.recovered && healthy.emails() === 1 && JSON.parse(store.value()).activeAlertFingerprint === null);
}

{
  const store = createStore();
  const rejected = createFetcher(healthResponse({ ok: false, issues: ["frequent_cron_stale"] }), { emailOk: false });
  const first = await runOperationsMonitor(createEnv(store), rejected.fetcher, now);
  const retry = createFetcher(healthResponse({ ok: false, issues: ["frequent_cron_stale"] }));
  const second = await runOperationsMonitor(createEnv(store), retry.fetcher, now + 5 * 60_000);
  check("a rejected alert is retried instead of being marked sent", !first.alerted && second.alerted && retry.emails() === 1);
}

console.log(`\n${passed} operations-monitor checks passed.`);
