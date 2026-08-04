import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import { logEvent } from "@/lib/activity/log";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Statuses a renter may still cancel from (mirrors the pre-lockdown RLS).
const CANCELLABLE = new Set(["requested", "pending_confirmation", "confirmed", "payment_pending"]);

// POST /api/bookings/{id}/cancel
//
// Renter-initiated cancellation. bookings is fully locked (no browser UPDATE),
// so this performs the guarded transition on the service client: verifies the
// caller owns the booking and it's in a cancellable state, stamps
// cancelled_by='renter', logs an audit event, and notifies the page (the
// button copy promises "the agency will be notified").
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  const service = await createServiceClient();

  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, vehicles(make, model, year), agencies(name, whatsapp_number)")
    .eq("id", id)
    .single();
  const booking = bookingRow as {
    id: string;
    renter_id: string;
    agency_id: string;
    status: string;
    vehicles: { make: string; model: string; year: number } | null;
    agencies: { name: string; whatsapp_number: string | null } | null;
  } | null;

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.renter_id !== user.id) return NextResponse.json({ error: "Not your booking." }, { status: 403 });
  if (!CANCELLABLE.has(booking.status)) {
    return NextResponse.json({ error: "This booking can no longer be cancelled here." }, { status: 409 });
  }

  const { error } = await service
    .from("bookings")
    .update({
      status:              "cancelled",
      cancelled_at:        new Date().toISOString(),
      cancellation_reason: "Cancelled by renter",
      cancelled_by:        "renter",
    })
    .eq("id", id)
    .in("status", Array.from(CANCELLABLE));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(service, {
    actorId:            user.id,
    actorRole:          "renter",
    eventType:          "booking.cancelled_by_renter",
    subjectKind:        "booking",
    subjectId:          id,
    relatedRenterId:    booking.renter_id,
    relatedAgencyId:    booking.agency_id,
    relatedBookingId:   id,
    metadata:           { previous_status: booking.status },
  });

  // Best-effort page notification (the button says the agency is notified).
  if (booking.agencies?.whatsapp_number) {
    const v = booking.vehicles;
    const vehicleName = v ? `${v.year} ${v.make} ${v.model}` : "a vehicle";
    const ref = id.slice(0, 8).toUpperCase();
    runAfterResponse(
      notifyCascade({
        phone:  booking.agencies.whatsapp_number,
        smsKey: "new_booking_agency",
        text:   `A renter cancelled their booking for ${vehicleName} (ref ${ref}). The dates are free again.`,
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
