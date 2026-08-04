import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canActOnAgency } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string; chargeId: string }> }

// DELETE /api/bookings/{id}/charges/{chargeId} - owner removes a line before
// the renter has accepted the settlement.
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id, chargeId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, settlement_ack_at, agency_id, agencies!inner(owner_id)")
    .eq("id", id)
    .single();
  const bk = bookingRow as { settlement_ack_at: string | null; agency_id: string; agencies: { owner_id: string } | null } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!(await canActOnAgency(service, user.id, bk.agency_id))) return NextResponse.json({ error: "Not your booking." }, { status: 403 });
  if (bk.settlement_ack_at) return NextResponse.json({ error: "Settlement already accepted: locked." }, { status: 409 });

  const { error } = await service.from("booking_charges").delete().eq("id", chargeId).eq("booking_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
