import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { kickNotificationOutbox } from "@/lib/notification-outbox";

// POST /api/admin/bookings/transition
// body: { bookingId: string, to: "confirmed" | "declined" | "completed" | "cancelled", note?: string, resolution_note?: string }
//
// Admin-only. Lets an admin move a booking on behalf of the agency,
// typically used when the admin spoke to the agency by phone and the
// agency confirmed verbally. Logs the action to activity_events so the
// audit trail makes it clear this was an admin transition, not the
// agency's own click.
//
// Status side-effects (confirmed_at / declined_at / etc.) mirror the
// agency-side flow in AgencyBookingActions so downstream code that
// reads those columns (cron expiry, reliability triggers) keeps working.
//
// Dispute resolution: when the booking being moved to 'completed' is
// currently 'disputed', resolution_note is required. It's logged on the
// activity_events row (same as `note`) and also written to every open
// incident filed against this booking, closing them out alongside the
// booking transition.

const ALLOWED_TRANSITIONS = new Set(["confirmed", "declined", "cancelled"] as const);
type AllowedStatus = typeof ALLOWED_TRANSITIONS extends Set<infer T> ? T : never;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((caller as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    bookingId:       string;
    to:              string;
    note:            string;
    resolution_note: string;
  }>;

  if (!body.bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  if (!body.to || !ALLOWED_TRANSITIONS.has(body.to as AllowedStatus)) {
    return NextResponse.json({ error: "Invalid transition target" }, { status: 400 });
  }
  const to = body.to as AllowedStatus;

  // Service client bypasses RLS so we can mutate on behalf of the agency.
  const service = await createServiceClient();

  // Fetch the booking so we have the previous status + related ids for audit.
  const { data: bookingBefore } = await service
    .from("bookings")
    .select("id, status, renter_id, agency_id")
    .eq("id", body.bookingId)
    .single();
  const prev = bookingBefore as {
    id:         string;
    status:     string;
    renter_id:  string;
    agency_id:  string;
  } | null;
  if (!prev) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (prev.status === "disputed") {
    return NextResponse.json(
      { error: "Disputed bookings must be decided in the Cases workspace." },
      { status: 409 },
    );
  }

  // The database function limits admin changes to genuine operational and
  // dispute-resolution paths. Booking status, open incidents, timestamps and
  // the resolution audit event commit together or not at all.
  const { error: updateError } = await service.rpc("transition_booking_lifecycle", {
    p_booking_id:      body.bookingId,
    p_actor_id:        user.id,
    p_to:              to,
    p_resolution_note: body.note?.trim() || null,
  });

  if (updateError) {
    console.error("[admin booking transition]", updateError);
    return NextResponse.json(
      { error: updateError.message },
      { status: updateError.code === "42501" ? 403 : 409 },
    );
  }

  // Audit log, admin acted on behalf of the agency.
  await service.from("activity_events").insert({
    actor_id:           user.id,
    actor_role:         "admin",
    event_type:         `booking.${to}_by_admin`,
    subject_kind:       "booking",
    subject_id:         body.bookingId,
    related_renter_id:  prev.renter_id,
    related_agency_id:  prev.agency_id,
    related_booking_id: body.bookingId,
    metadata: {
      previous_status: prev.status,
      note:            body.note ?? null,
    },
  });

  kickNotificationOutbox(service, 40);

  return NextResponse.json({ ok: true, previousStatus: prev.status, newStatus: to });
}
