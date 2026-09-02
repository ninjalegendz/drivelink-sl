import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAgencyOwner } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/pages/{id}/activation  body: { active: boolean }  (PAGE-005)
//
// Pause / resume a Rental Page. Owner-only. Every public surface and the
// booking-create route gate on vehicles.status = 'available', so pausing just
// unlists the page's available vehicles (stamping paused_at) and hides the
// public profile via agencies.deactivated_at. Resuming re-lists exactly the
// vehicles that were auto-unlisted.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: agencyId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  if (!(await isAgencyOwner(service, user.id, agencyId))) {
    return NextResponse.json({ error: "Only the page owner can do that." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{ active: boolean }>;
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Missing 'active'." }, { status: 400 });
  }

  if (body.active) {
    // The database verifies the page, phone and ownership, then resumes the
    // page and its auto-paused vehicles in one transaction.
    const { error } = await service.rpc("set_rental_page_active", {
      p_agency_id: agencyId,
      p_owner_id: user.id,
      p_active: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  } else {
    const { error } = await service.rpc("set_rental_page_active", {
      p_agency_id: agencyId,
      p_owner_id: user.id,
      p_active: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // Browse pages cache vehicle rows under this tag.
  revalidateTag("vehicles");

  return NextResponse.json({ ok: true, active: body.active });
}
