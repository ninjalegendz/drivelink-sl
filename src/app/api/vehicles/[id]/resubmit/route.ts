import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canPerformPageAction } from "@/lib/pages/access";
import { listingPublicationProblem } from "@/lib/vehicles/trust";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/vehicles/{id}/resubmit - the owner resubmits a rejected (unlisted)
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
    .select("id, status, agency_id, plate_number, photos, self_drive, with_driver, daily_rate_lkr, rejection_reason, listing_authority_basis, listing_authority_declared, listing_authority_confirmed_at, listing_authority_confirmed_by, listing_authority_declaration_version, agencies(owner_id)")
    .eq("id", id)
    .single();
  const v = vehicleRow as {
    status: string;
    agency_id: string;
    plate_number: string | null;
    photos: string[] | null;
    self_drive: boolean;
    with_driver: boolean;
    daily_rate_lkr: number;
    rejection_reason: string | null;
    listing_authority_basis: string | null;
    listing_authority_declared: boolean;
    listing_authority_confirmed_at: string | null;
    listing_authority_confirmed_by: string | null;
    listing_authority_declaration_version: string | null;
    agencies: { owner_id: string } | null;
  } | null;
  if (!v) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  if (!(await canPerformPageAction(service, user.id, v.agency_id, "manage_fleet"))) return NextResponse.json({ error: "Your staff role cannot manage vehicles." }, { status: 403 });
  if (v.status !== "unlisted") {
    return NextResponse.json({ error: "Only an unlisted (rejected) listing can be resubmitted." }, { status: 409 });
  }
  const publicationProblem = listingPublicationProblem(v, { approvalClearsRejection: true });
  if (publicationProblem) {
    return NextResponse.json({ error: publicationProblem }, { status: 409 });
  }

  const { error } = await service
    .from("vehicles")
    .update({ status: "pending_review", rejection_reason: null })
    .eq("id", id)
    .eq("status", "unlisted");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
