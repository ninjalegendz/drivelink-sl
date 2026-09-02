import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The existing 15-minute scheduler calls this lightweight nudge. Heavy file
// reads and ZIP creation happen in the Supabase background function, whose
// free-plan runtime is suitable for bounded R2 I/O; the Cloudflare Free
// Worker remains responsible only for this small authenticated request.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const evidenceSecret = process.env.EVIDENCE_EXPORT_SECRET;
  if (!base || !evidenceSecret) {
    return NextResponse.json({ error: "Evidence-export worker is not configured." }, { status: 503 });
  }

  const startedAt = new Date().toISOString();
  const service = await createServiceClient();
  await service.from("job_heartbeats").upsert({
    job_name: "evidence-exports",
    last_started_at: startedAt,
    last_error: null,
    updated_at: startedAt,
  });

  try {
    const response = await fetch(`${base}/functions/v1/evidence-export-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Evidence-Export-Key": evidenceSecret,
      },
      body: JSON.stringify({ mode: "claim" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Evidence worker returned ${response.status}.`);

    const finishedAt = new Date().toISOString();
    await service.from("job_heartbeats").upsert({
      job_name: "evidence-exports",
      last_started_at: startedAt,
      last_ok_at: finishedAt,
      last_error: null,
      details: payload,
      updated_at: finishedAt,
    });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Evidence worker request failed.";
    await service.from("job_heartbeats").upsert({
      job_name: "evidence-exports",
      last_started_at: startedAt,
      last_error: message,
      updated_at: new Date().toISOString(),
    });
    console.error("[cron evidence-exports]", error);
    return NextResponse.json({ error: "Evidence worker could not be started." }, { status: 502 });
  }
}
