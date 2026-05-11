import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST /api/admin/rating-adjust
// body: { target_kind: 'renter' | 'agency', target_id, field, delta, reason }
//
// Manual override of a profile's rating_avg / reliability_pct (for renters
// or agencies). Logs every adjustment with admin id + reason in the
// rating_adjustments table so we have an audit trail. Renters'
// rating/reliability live on profiles; agencies' on agencies.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((callerProfile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    target_kind: "renter" | "agency";
    target_id:   string;
    field:       "rating_avg" | "reliability_pct";
    delta:       number;
    reason:      string;
  }>;

  if (!body.target_kind || !body.target_id || !body.field || typeof body.delta !== "number" || !body.reason) {
    return NextResponse.json({ error: "All fields required: target_kind, target_id, field, delta, reason." }, { status: 400 });
  }
  if (!["renter", "agency"].includes(body.target_kind)) {
    return NextResponse.json({ error: "Invalid target_kind." }, { status: 400 });
  }
  if (!["rating_avg", "reliability_pct"].includes(body.field)) {
    return NextResponse.json({ error: "Invalid field." }, { status: 400 });
  }
  if (body.reason.trim().length < 5) {
    return NextResponse.json({ error: "Reason must be at least 5 characters." }, { status: 400 });
  }

  const service = await createServiceClient();
  const table = body.target_kind === "renter" ? "profiles" : "agencies";

  // Read current value, clamp the new value to a sensible range
  const { data: current } = await service.from(table).select(body.field).eq("id", body.target_id).single();
  const curRaw = (current as Record<string, number | null> | null)?.[body.field];
  const cur = typeof curRaw === "number" ? curRaw : 0;
  let next = cur + body.delta;

  // Clamp: rating_avg is 0–5, reliability_pct is 0–100
  if (body.field === "rating_avg") {
    next = Math.max(0, Math.min(5,   next));
  } else {
    next = Math.max(0, Math.min(100, Math.round(next)));
  }

  const { error: updateError } = await service.from(table).update({ [body.field]: next }).eq("id", body.target_id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log the adjustment
  await service.from("rating_adjustments").insert({
    target_kind: body.target_kind,
    target_id:   body.target_id,
    admin_id:    user.id,
    field:       body.field,
    delta_value: body.delta,
    new_value:   next,
    reason:      body.reason.trim(),
  });

  return NextResponse.json({ ok: true, previous: cur, new_value: next });
}
