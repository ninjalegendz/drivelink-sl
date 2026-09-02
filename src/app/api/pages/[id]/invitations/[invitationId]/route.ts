import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAgencyOwner } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string; invitationId: string }> }

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id: agencyId, invitationId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  if (!(await isAgencyOwner(service, user.id, agencyId))) {
    return NextResponse.json({ error: "Only the page owner can cancel a team invitation." }, { status: 403 });
  }
  const { data, error } = await service.rpc("cancel_agency_member_invitation", {
    p_invitation_id: invitationId,
    p_owner_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message || "Couldn't cancel the invitation." }, { status: 409 });
  return NextResponse.json(data);
}
