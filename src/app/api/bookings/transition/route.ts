import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";
import { canPerformPageAction } from "@/lib/pages/access";
import { kickNotificationOutbox } from "@/lib/notification-outbox";

// POST /api/bookings/transition
// body: { bookingId: string, to: "confirmed" | "declined" | "completed" | "cancelled", reason?: string }
//
// Rental Page endpoint. Ownership and every lifecycle prerequisite are
// checked by the server and the central database state machine. The same
// transaction records the matching notification event; delivery happens
// asynchronously through the retryable outbox.
//
// "cancelled" is handled separately (handlePageCancellation below): it's
// the page cancelling a booking the renter already committed to, so it
// needs an explicit party + status + pickup-window check via the service
// client rather than relying on RLS (which would silently no-op on a
// bad caller instead of erroring, and has no notion of "before pickup"),
// plus the strike bookkeeping that makes late cancellations cost the page.

const ALLOWED = new Set(["confirmed", "active", "declined", "completed", "cancelled"] as const);
type AllowedStatus = typeof ALLOWED extends Set<infer T> ? T : never;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    bookingId: string;
    to:        string;
    reason:    string;
  }>;
  if (!body.bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  if (!body.to || !ALLOWED.has(body.to as AllowedStatus)) {
    return NextResponse.json({ error: "Invalid transition target" }, { status: 400 });
  }
  const to = body.to as AllowedStatus;

  if (to === "cancelled") {
    return handlePageCancellation(body.bookingId, user.id, body.reason);
  }

  // bookings is locked to server-side writes, so ownership is enforced here
  // explicitly (was previously the "Agency can transition booking" RLS gate):
  // the caller must own the page, and the booking must be in a live,
  // transitionable state. The write then runs on the service client.
  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, status, agency_id")
    .eq("id", body.bookingId)
    .single();
  const bk = bookingRow as {
    id: string;
    status: string;
    agency_id: string;
  } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const capability = to === "confirmed" || to === "declined" ? "manage_booking" : "manage_handover";
  if (!(await canPerformPageAction(service, user.id, bk.agency_id, capability))) {
    return NextResponse.json({ error: capability === "manage_booking" ? "Your staff role cannot confirm or decline requests." : "Your staff role cannot start or complete rentals." }, { status: 403 });
  }
  if (to === "confirmed") {
    const { data: pageEligible, error: eligibilityError } = await service.rpc("rental_page_is_public", {
      p_agency_id: bk.agency_id,
    });
    if (eligibilityError || pageEligible !== true) {
      return NextResponse.json(
        { error: "This Rental Page cannot confirm new bookings right now. Check the owner's identity status and the page's verification, phone, and active status." },
        { status: 409 },
      );
    }
  }
  // Migration 086 owns the authoritative state machine. It locks the booking
  // row, re-checks the actor and every handover/return prerequisite, then writes
  // once. Stale tabs and double-clicks therefore fail instead of sending a
  // success notification for an update that matched zero rows.
  const { error: updateError } = await service.rpc("transition_booking_lifecycle", {
    p_booking_id:      body.bookingId,
    p_actor_id:        user.id,
    p_to:              to,
    p_resolution_note: null,
  });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message, code: updateError.code },
      { status: updateError.code === "42501" ? 403 : updateError.code === "23P01" ? 409 : 409 },
    );
  }

  // The lifecycle update and every auto-decline created their outbox rows
  // transactionally. Wake enough deliveries to include competing requests.
  kickNotificationOutbox(service, 40);

  return NextResponse.json({ ok: true, newStatus: to });
}

// The page cancelling a confirmed/active booking before pickup. Own path
// (see the block comment at the top of the file for why): explicit
// party + status + window check via the service client, strike
// bookkeeping, and a renter notification pointed at the marketplace
// rather than the (now dead-end) booking page.
async function handlePageCancellation(
  bookingId: string | undefined,
  userId:    string,
  reason:    string | undefined,
): Promise<NextResponse> {
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const service = await createServiceClient();
  const { data: row } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, start_at")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id: string; renter_id: string; agency_id: string; status: string; start_at: string;
  };
  const b = row as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Explicit party check - don't rely on RLS alone here. It reaches the
  // same verdict, but a bad caller against a bare `.update()` would just
  // silently match zero rows and still get a 200, which is a worse
  // failure mode for a "your cancellation went through" action.
  if (!(await canPerformPageAction(service, userId, b.agency_id, "manage_cases"))) {
    return NextResponse.json({ error: "Only the page owner or a manager can cancel a renter's booking." }, { status: 403 });
  }
  if (b.status !== "confirmed" && b.status !== "active") {
    return NextResponse.json(
      { error: "Only a confirmed or active booking can be cancelled by the page." },
      { status: 400 },
    );
  }
  const startMs = new Date(b.start_at).getTime();
  const pickupPassed = startMs <= Date.now();
  // A live (active) rental past pickup is a dispute, not a cancellation.
  if (b.status === "active" && pickupPassed) {
    return NextResponse.json(
      { error: "This booking's pickup time has already passed. Use dispute reporting instead." },
      { status: 400 },
    );
  }
  // A CONFIRMED booking whose pickup passed is a renter no-show. Decision 3
  // introduced this state (reserved bookings no longer auto-activate), so the
  // owner must be able to release it - it otherwise holds the dates forever.
  // Neutral 'system' attribution: it frees the dates without striking the page
  // or auto-penalising the renter (the owner can report a genuine no-show
  // separately).
  const isNoShow = b.status === "confirmed" && pickupPassed;

  const now = new Date().toISOString();
  const trimmedReason = reason?.trim();
  const cancellationReason = isNoShow
    ? "Reserved booking released: the vehicle was not picked up."
    : trimmedReason
      ? `Cancelled by the Rental Page: ${trimmedReason}`
      : "Cancelled by the Rental Page";

  const { data: cancelledRows, error: updateError } = await service
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: now, cancellation_reason: cancellationReason, cancelled_by: isNoShow ? "system" : "page" })
    .eq("id", bookingId)
    .eq("status", b.status)
    .select("id");
  if (updateError) {
    console.error("[booking transition] page cancel failed", bookingId, updateError);
    return NextResponse.json({ error: "Couldn't cancel the booking. Try again." }, { status: 500 });
  }
  if (!cancelledRows || cancelledRows.length === 0) {
    return NextResponse.json(
      { error: "The booking changed before it could be cancelled. Refresh and try again." },
      { status: 409 },
    );
  }

  // The database adds the 48-hour strike atomically in the same transaction
  // as a page-attributed cancellation. No-show releases use system attribution
  // and therefore never receive a page strike.
  const withinStrikeWindow = !isNoShow && startMs - Date.now() <= 48 * 60 * 60 * 1000;

  if (withinStrikeWindow) {
    await logEvent(service, {
      actorId:          userId,
      actorRole:        "agency_owner",
      eventType:        "page_late_cancel",
      subjectKind:      "booking",
      subjectId:        b.id,
      relatedRenterId:  b.renter_id,
      relatedAgencyId:  b.agency_id,
      relatedBookingId: b.id,
      metadata: {
        start_at:            b.start_at,
        hours_before_pickup: Math.round((startMs - Date.now()) / 3_600_000),
        reason:              trimmedReason ?? null,
      },
    });
  }

  kickNotificationOutbox(service);

  return NextResponse.json({ ok: true, newStatus: "cancelled" });
}
