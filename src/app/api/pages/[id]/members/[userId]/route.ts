import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string; userId: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id: agencyId, userId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ canViewRenterDocuments: boolean; role: string }>;
  const changingRole = body.role !== undefined;
  const changingDocuments = typeof body.canViewRenterDocuments === "boolean";
  if (!changingRole && !changingDocuments) return NextResponse.json({ error: "Choose a staff role or document permission." }, { status: 400 });
  if (changingRole && !isStaffRole(body.role)) return NextResponse.json({ error: "Choose a valid staff role." }, { status: 400 });

  if (changingRole) {
    const { error } = await supabase.rpc("set_agency_member_role", {
      p_agency_id: agencyId,
      p_member_user_id: userId,
      p_role: body.role,
    });
    if (error) {
      const status = error.message.includes("Only the page owner") ? 403 : 400;
      return NextResponse.json({ error: status === 403 ? "Only the page owner can change staff roles." : error.message || "Couldn't update the staff role." }, { status });
    }
  }

  if (changingDocuments) {
    const { error } = await supabase.rpc("set_agency_member_document_permission", {
      p_agency_id: agencyId,
      p_member_user_id: userId,
      p_enabled: body.canViewRenterDocuments,
    });
    if (error) {
      const status = error.message.includes("Only the page owner") ? 403 : 400;
      return NextResponse.json({ error: status === 403 ? "Only the page owner can change document access." : error.message || "Couldn't update document access." }, { status });
    }
  }

  return NextResponse.json({ ok: true, role: changingRole ? body.role : undefined, canViewRenterDocuments: changingDocuments ? body.canViewRenterDocuments : undefined });
}

// DELETE /api/pages/{id}/members/{userId} - remove staff (PAGE-005).
// Allowed for the page owner (removing anyone) or the staff member themselves
// (leaving). Removal is a hard delete: the row gone = access gone immediately.
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id: agencyId, userId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { error } = await service.rpc("remove_agency_member", {
    p_agency_id: agencyId,
    p_actor_id: user.id,
    p_member_user_id: userId,
  });
  if (error) {
    const status = error.message.includes("cannot remove") ? 403 : error.message.includes("not found") || error.message.includes("not an active") ? 404 : 400;
    return NextResponse.json({ error: error.message || "Couldn't remove staff." }, { status });
  }

  return NextResponse.json({ ok: true });
}
