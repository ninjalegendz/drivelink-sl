import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildEvidencePack } from "@/lib/booking/evidence-pack";
import { canActOnAgency } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

// GET /api/bookings/{id}/evidence-pack - the Rental Page owner (or an admin)
// downloads a single ZIP: fingerprinted agreement PDF, a summary PDF (parties,
// identity summary, inspections, timeline, transcript), and the inspection
// vehicle photos (TRUST-024). Built for a late-return / dispute / police case.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, agency_id, agencies!inner(owner_id)")
    .eq("id", id)
    .single();
  const bk = bookingRow as { agency_id: string; agencies: { owner_id: string } | null } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  let ok = await canActOnAgency(service, user.id, bk.agency_id);
  if (!ok) {
    const { data: me } = await service.from("profiles").select("role").eq("id", user.id).single();
    ok = (me as { role?: string } | null)?.role === "admin";
  }
  if (!ok) return NextResponse.json({ error: "Only the Rental Page or an admin can export the evidence pack." }, { status: 403 });

  const zip = await buildEvidencePack(service, id);
  if (!zip) return NextResponse.json({ error: "Couldn't build the evidence pack." }, { status: 500 });

  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="drivelink-evidence-${id.slice(0, 8)}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
