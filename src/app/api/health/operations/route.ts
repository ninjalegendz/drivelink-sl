import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FREQUENT_HEARTBEAT_MAX_AGE_MS = 45 * 60_000;
const DAILY_HEARTBEAT_MAX_AGE_MS = 30 * 60 * 60_000;

// A failure that already happened never un-happens, so counting them for all
// time makes this endpoint report unhealthy forever after the first one and
// alert every five minutes until somebody edits the database by hand. Three
// dead test notifications from 14 August produced roughly 1,700 alert emails
// that way, which is worse than silence: it teaches the team to ignore the
// alarm. Only failures inside this window count as a live incident; older ones
// stay in the table as history.
const FAILURE_WINDOW_MS = 24 * 60 * 60_000;

function isFresh(value: string | null | undefined, maxAgeMs: number, now: number): boolean {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) && timestamp >= now - maxAgeMs && timestamp <= now + 5 * 60_000;
}

// This endpoint is for the independent operations monitor only. It deliberately
// returns no internal details to a caller without the scheduler secret.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 404 });
  }

  const now = Date.now();
  const service = await createServiceClient();
  const [frequentResult, dailyResult, deadResult, evidenceResult, failedEvidenceResult] = await Promise.all([
    service.from("job_heartbeats")
      .select("last_ok_at,last_error")
      .eq("job_name", "expire-bookings:frequent")
      .maybeSingle(),
    service.from("job_heartbeats")
      .select("last_ok_at,last_error")
      .eq("job_name", "expire-bookings:daily")
      .maybeSingle(),
    service.from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "dead")
      .gte("dead_at", new Date(now - FAILURE_WINDOW_MS).toISOString()),
    service.from("job_heartbeats")
      .select("last_ok_at,last_error")
      .eq("job_name", "evidence-exports")
      .maybeSingle(),
    service.from("evidence_exports")
      .select("id", { count: "exact", head: true })
      .eq("preparation_status", "failed")
      .gte("created_at", new Date(now - FAILURE_WINDOW_MS).toISOString()),
  ]);

  const issues: string[] = [];
  if (frequentResult.error || !isFresh(frequentResult.data?.last_ok_at, FREQUENT_HEARTBEAT_MAX_AGE_MS, now)) {
    issues.push("frequent_cron_stale");
  }
  if (dailyResult.error || !isFresh(dailyResult.data?.last_ok_at, DAILY_HEARTBEAT_MAX_AGE_MS, now)) {
    issues.push("daily_cron_stale");
  }
  if (evidenceResult.error || !isFresh(evidenceResult.data?.last_ok_at, FREQUENT_HEARTBEAT_MAX_AGE_MS, now)) {
    issues.push("evidence_export_worker_stale");
  }
  if (failedEvidenceResult.error) {
    issues.push("evidence_export_queue_unavailable");
  } else if ((failedEvidenceResult.count ?? 0) > 0) {
    issues.push("evidence_export_failed");
  }
  if (deadResult.error) {
    issues.push("notification_queue_unavailable");
  } else if ((deadResult.count ?? 0) > 0) {
    issues.push("notification_delivery_failed");
  }

  const ok = issues.length === 0;
  return NextResponse.json(
    { ok, checkedAt: new Date(now).toISOString(), issues },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
