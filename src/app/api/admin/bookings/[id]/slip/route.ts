import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

// POST /api/admin/bookings/{id}/slip   body: { approve: boolean }
//
// Admin verifies a payment slip. Guarded on the service client: the booking
// must still be in 'payment_pending' (so a slip approved after the booking
// was cancelled elsewhere can't silently revive it - BOOK-023). Approve
// activates the booking; reject rolls back to 'confirmed' and clears the slip
// so the renter can re-upload.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ approve: boolean }>;
  if (typeof body.approve !== "boolean") {
    return NextResponse.json({ error: "approve (boolean) is required." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, status, renter_id, agency_id")
    .eq("id", id)
    .single();
  const booking = bookingRow as { id: string; status: string; renter_id: string; agency_id: string } | null;
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "payment_pending") {
    return NextResponse.json(
      { error: `This booking is '${booking.status}', not awaiting slip verification.` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const update = body.approve
    ? { status: "active", slip_verified_at: now, payment_received_at: now, activated_at: now }
    : { status: "confirmed", slip_url: null };

  const { error } = await service
    .from("bookings")
    .update(update)
    .eq("id", id)
    .eq("status", "payment_pending");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(service, {
    actorId:          auth.user.id,
    actorRole:        "admin",
    eventType:        body.approve ? "booking.slip_approved" : "booking.slip_rejected",
    subjectKind:      "booking",
    subjectId:        id,
    relatedRenterId:  booking.renter_id,
    relatedAgencyId:  booking.agency_id,
    relatedBookingId: id,
  });

  return NextResponse.json({ ok: true });
}
