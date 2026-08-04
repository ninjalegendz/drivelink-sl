import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAgencyOwner } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string; userId: string }> }

// DELETE /api/pages/{id}/members/{userId} — remove staff (PAGE-005).
// Allowed for the page owner (removing anyone) or the staff member themselves
// (leaving). Removal is a hard delete: the row gone = access gone immediately.
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id: agencyId, userId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const isOwner = await isAgencyOwner(service, user.id, agencyId);
  const isSelf  = user.id === userId;
  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "You can't remove that person." }, { status: 403 });
  }

  const { error } = await service
    .from("agency_members")
    .delete()
    .eq("agency_id", agencyId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Couldn't remove staff. Try again." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
