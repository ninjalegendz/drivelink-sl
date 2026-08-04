import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const TARGETS = new Set(["vehicle", "page", "renter"]);
const CATEGORIES = new Set([
  "fake_or_stolen", "wrong_info", "inappropriate", "scam", "duplicate", "other",
]);

// POST /api/reports - a signed-in user reports a listing / page / account.
// body: { target_type, target_id, category, detail? }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    target_type: string; target_id: string; category: string; detail: string;
  }>;
  if (!body.target_type || !TARGETS.has(body.target_type)) {
    return NextResponse.json({ error: "Invalid target." }, { status: 400 });
  }
  if (!body.target_id || !/^[0-9a-f-]{36}$/i.test(body.target_id)) {
    return NextResponse.json({ error: "Invalid target id." }, { status: 400 });
  }
  if (!body.category || !CATEGORIES.has(body.category)) {
    return NextResponse.json({ error: "Pick a reason." }, { status: 400 });
  }

  const service = await createServiceClient();

  // Light dedupe / rate-limit: one open report per user per target, and no more
  // than 20 reports from a user in 24h.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: recent } = await service
    .from("content_reports").select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id).gt("created_at", since);
  if ((recent ?? 0) >= 20) {
    return NextResponse.json({ error: "You've reported a lot recently. Try again later." }, { status: 429 });
  }
  const { data: dupe } = await service
    .from("content_reports").select("id")
    .eq("reporter_id", user.id).eq("target_type", body.target_type).eq("target_id", body.target_id)
    .eq("status", "open").limit(1).maybeSingle();
  if (dupe) return NextResponse.json({ ok: true, already: true });

  const { error } = await service.from("content_reports").insert({
    target_type: body.target_type,
    target_id:   body.target_id,
    reporter_id: user.id,
    category:    body.category,
    detail:      body.detail?.trim()?.slice(0, 2000) || null,
  });
  if (error) return NextResponse.json({ error: "Couldn't submit the report." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
