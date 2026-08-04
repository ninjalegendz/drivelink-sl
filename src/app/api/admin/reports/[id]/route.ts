import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";

interface RouteContext { params: Promise<{ id: string }> }

// PATCH /api/admin/reports/{id}  body: { status: "reviewed" | "dismissed" }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((me as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ status: string }>;
  if (body.status !== "reviewed" && body.status !== "dismissed") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("content_reports")
    .update({ status: body.status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(service, {
    actorId: user.id, actorRole: "admin",
    eventType: `admin.report_${body.status}`, subjectKind: "renter", subjectId: id,
  });
  return NextResponse.json({ ok: true });
}
