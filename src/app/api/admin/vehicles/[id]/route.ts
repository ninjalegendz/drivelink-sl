import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";
import { ALL_BADGES } from "@/data/vehicles";

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

const APPROVAL_STATUSES = new Set(["pending_review", "available", "unlisted"]);

// PATCH /api/admin/vehicles/{id}
// body: { status?, is_featured?, badges? }
//
// Admin moderation of a listing. status / is_featured / verified_vehicle /
// badges are protected columns (service-role only after the vehicles column
// lockdown), so approve/reject, feature, and badge editing all come through
// here instead of a direct browser write.
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status:           string;
    is_featured:      boolean;
    badges:           string[];
    rejection_reason: string;
  }>;

  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!APPROVAL_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status. Use pending_review, available, or unlisted." }, { status: 400 });
    }
    update.status = body.status;
    // UX-008: a rejection (→ unlisted) records the reason the owner sees;
    // approving or sending back to review clears any prior reason.
    update.rejection_reason = body.status === "unlisted" ? (body.rejection_reason?.trim() || null) : null;
  }

  if (typeof body.is_featured === "boolean") update.is_featured = body.is_featured;

  if (body.badges !== undefined) {
    if (!Array.isArray(body.badges) || body.badges.some((b) => !ALL_BADGES.includes(b))) {
      return NextResponse.json({ error: "Invalid badge set." }, { status: 400 });
    }
    update.badges = body.badges;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from("vehicles").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent(service, {
    actorId:     auth.user.id,
    actorRole:   "admin",
    eventType:   "admin.vehicle_moderated",
    subjectKind: "vehicle",
    subjectId:   id,
    metadata:    { fields: Object.keys(update), ...(update.status ? { status: update.status } : {}) },
  });

  return NextResponse.json({ ok: true });
}
