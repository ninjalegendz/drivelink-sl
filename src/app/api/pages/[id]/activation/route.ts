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
    // Resume: clear the page flag and re-list exactly the vehicles we paused.
    await service.from("agencies").update({ deactivated_at: null }).eq("id", agencyId);
    await service.from("vehicles")
      .update({ status: "available", paused_at: null })
      .eq("agency_id", agencyId)
      .not("paused_at", "is", null);
  } else {
    // Pause: hide the page and unlist its currently-available vehicles.
    await service.from("agencies").update({ deactivated_at: new Date().toISOString() }).eq("id", agencyId);
    await service.from("vehicles")
      .update({ status: "unlisted", paused_at: new Date().toISOString() })
      .eq("agency_id", agencyId)
      .eq("status", "available");
  }

  // Browse pages cache vehicle rows under this tag.
  revalidateTag("vehicles");

  return NextResponse.json({ ok: true, active: body.active });
}
