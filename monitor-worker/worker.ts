// Independent operational monitor. It is intentionally a tiny Worker rather
// than part of the Next.js bundle so it can notice a failed app/cron path.

const STATE_KEY = "operations-monitor-state";
const ALERT_REPEAT_MS = 6 * 60 * 60_000;

export interface MonitorStateStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface MonitorEnv {
  TARGET_URL: string;
  CRON_SECRET: string;
  ALERT_TO_EMAIL: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  RESEND_FROM_NAME?: string;
  MONITOR_STATE: MonitorStateStore;
}

export interface MonitorState {
  activeAlertFingerprint: string | null;
  lastAlertAt: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
}

export interface HealthResult {
  ok: boolean;
  fingerprint: string | null;
}

type FetchLike = typeof fetch;

function defaultState(): MonitorState {
  return {
    activeAlertFingerprint: null,
    lastAlertAt: null,
    lastFailureAt: null,
    lastSuccessAt: null,
  };
}

function parseState(value: string | null): MonitorState {
  if (!value) return defaultState();
  try {
    const parsed = JSON.parse(value) as Partial<MonitorState>;
    return {
      activeAlertFingerprint: typeof parsed.activeAlertFingerprint === "string" ? parsed.activeAlertFingerprint : null,
      lastAlertAt: typeof parsed.lastAlertAt === "string" ? parsed.lastAlertAt : null,
      lastFailureAt: typeof parsed.lastFailureAt === "string" ? parsed.lastFailureAt : null,
      lastSuccessAt: typeof parsed.lastSuccessAt === "string" ? parsed.lastSuccessAt : null,
    };
  } catch {
    return defaultState();
  }
}

function isOlderThan(value: string | null, maxAgeMs: number, now: number): boolean {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || timestamp < now - maxAgeMs;
}

export async function checkOperations(env: Pick<MonitorEnv, "TARGET_URL" | "CRON_SECRET">, fetcher: FetchLike): Promise<HealthResult> {
  const target = `${env.TARGET_URL.replace(/\/+$/, "")}/api/health/operations`;
  try {
    const response = await fetcher(target, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => null) as { ok?: unknown; issues?: unknown } | null;
    if (response.ok && body?.ok === true) return { ok: true, fingerprint: null };
    const issues = Array.isArray(body?.issues)
      ? body.issues.filter((issue): issue is string => typeof issue === "string").sort()
      : [];
    return { ok: false, fingerprint: issues.length > 0 ? `health:${issues.join(",")}` : `http:${response.status}` };
  } catch {
    return { ok: false, fingerprint: "health_request_failed" };
  }
}

export function shouldSendAlert(state: MonitorState, fingerprint: string, now: number): boolean {
  return state.activeAlertFingerprint !== fingerprint || isOlderThan(state.lastAlertAt, ALERT_REPEAT_MS, now);
}

async function sendEmail(env: MonitorEnv, fetcher: FetchLike, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.ALERT_TO_EMAIL) {
    console.error("[operations monitor] alert email is not configured");
    return false;
  }
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${env.RESEND_FROM_NAME || "DriveLink"} <${env.RESEND_FROM_EMAIL}>`,
        to: [env.ALERT_TO_EMAIL],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      console.error("[operations monitor] alert email rejected", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[operations monitor] alert email failed", error);
    return false;
  }
}

export async function runOperationsMonitor(
  env: MonitorEnv,
  fetcher: FetchLike = fetch,
  now = Date.now(),
): Promise<{ healthy: boolean; alerted: boolean; recovered: boolean }> {
  const state = parseState(await env.MONITOR_STATE.get(STATE_KEY));
  const checked = await checkOperations(env, fetcher);
  const timestamp = new Date(now).toISOString();

  if (checked.ok) {
    const recovered = state.activeAlertFingerprint !== null;
    const recoverySent = !recovered || await sendEmail(
      env,
      fetcher,
      "DriveLink operations recovered",
      `DriveLink's operations monitor recovered at ${timestamp}. The previously alerted condition was: ${state.activeAlertFingerprint}.`,
    );
    await env.MONITOR_STATE.put(STATE_KEY, JSON.stringify({
      ...state,
      activeAlertFingerprint: recoverySent ? null : state.activeAlertFingerprint,
      lastSuccessAt: timestamp,
    } satisfies MonitorState));
    console.log(`[operations monitor] healthy recovered=${recovered && recoverySent}`);
    return { healthy: true, alerted: false, recovered: recovered && recoverySent };
  }

  const fingerprint = checked.fingerprint || "unknown_failure";
  const alertDue = shouldSendAlert(state, fingerprint, now);
  const alertSent = alertDue && await sendEmail(
    env,
    fetcher,
    "DriveLink operations needs attention",
    `DriveLink's independent monitor detected an operations problem at ${timestamp}. Condition: ${fingerprint}. Open the Cloudflare and DriveLink admin operations screens to investigate.`,
  );
  await env.MONITOR_STATE.put(STATE_KEY, JSON.stringify({
    ...state,
    activeAlertFingerprint: alertSent ? fingerprint : state.activeAlertFingerprint,
    lastAlertAt: alertSent ? timestamp : state.lastAlertAt,
    lastFailureAt: timestamp,
  } satisfies MonitorState));
  console.error(`[operations monitor] unhealthy condition=${fingerprint} alerted=${alertSent}`);
  return { healthy: false, alerted: alertSent, recovered: false };
}

export default {
  async scheduled(_event: ScheduledController, env: MonitorEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runOperationsMonitor(env));
  },
  async fetch(request: Request, env: MonitorEnv): Promise<Response> {
    const url = new URL(request.url);
    if (
      request.method !== "POST"
      || url.pathname !== "/internal/run"
      || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
    ) {
      return new Response("Not found", { status: 404 });
    }
    const result = await runOperationsMonitor(env);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  },
} satisfies ExportedHandler<MonitorEnv>;
