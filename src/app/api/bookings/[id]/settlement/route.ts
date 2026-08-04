import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/bookings/{id}/settlement — the RENTER acknowledges the final
// settlement statement, locking the charge ledger. Two-sided sign-off: the
// owner itemised the charges, the renter accepts the net figure.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, settlement_ack_at")
    .eq("id", id)
    .single();
  const bk = bookingRow as { renter_id: string; agency_id: string; settlement_ack_at: string | null } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (bk.renter_id !== user.id) return NextResponse.json({ error: "Only the renter accepts the settlement." }, { status: 403 });
  if (bk.settlement_ack_at) return NextResponse.json({ ok: true, already: true });

  const now = new Date().toISOString();
  const { error } = await service.from("bookings").update({ settlement_ack_at: now }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(service, {
    actorId: user.id, actorRole: "renter", eventType: "booking.settlement_accepted",
    subjectKind: "booking", subjectId: id,
    relatedRenterId: bk.renter_id, relatedAgencyId: bk.agency_id, relatedBookingId: id,
  });
  return NextResponse.json({ ok: true });
}
