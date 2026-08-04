import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canActOnAgency } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/vehicles/{id}/resubmit — the owner resubmits a rejected (unlisted)
// listing for admin review (UX-008). Clears the rejection reason and sends it
// back to pending_review.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: vehicleRow } = await service
    .from("vehicles")
    .select("id, status, agency_id, agencies(owner_id)")
    .eq("id", id)
    .single();
  const v = vehicleRow as { status: string; agency_id: string; agencies: { owner_id: string } | null } | null;
  if (!v) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  if (!(await canActOnAgency(service, user.id, v.agency_id))) return NextResponse.json({ error: "Not your vehicle." }, { status: 403 });
  if (v.status !== "unlisted") {
    return NextResponse.json({ error: "Only an unlisted (rejected) listing can be resubmitted." }, { status: 409 });
  }

  const { error } = await service
    .from("vehicles")
    .update({ status: "pending_review", rejection_reason: null })
    .eq("id", id)
    .eq("status", "unlisted");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
