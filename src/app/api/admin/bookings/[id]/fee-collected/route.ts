import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

// POST /api/admin/bookings/{id}/fee-collected   body: { collected: boolean }
//
// Admin marks the platform fee for a completed booking as collected / not.
// agency_fee_collected_at is a protected bookings column, so the invoice
// toggle runs here on the service client.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ collected: boolean }>;
  if (typeof body.collected !== "boolean") {
    return NextResponse.json({ error: "collected (boolean) is required." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("bookings")
    .update({ agency_fee_collected_at: body.collected ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(service, {
    actorId:          auth.user.id,
    actorRole:        "admin",
    eventType:        body.collected ? "admin.fee_marked_collected" : "admin.fee_marked_uncollected",
    subjectKind:      "booking",
    subjectId:        id,
    relatedBookingId: id,
  });

  return NextResponse.json({ ok: true });
}
