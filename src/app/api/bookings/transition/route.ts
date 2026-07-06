import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  buildRenterConfirmedMessage,
  buildRenterDeclinedMessage,
  buildRenterCompletedMessage,
  buildRenterPageCancelledMessage,
} from "@/lib/sms/messages";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import { logEvent } from "@/lib/activity/log";
import { createAgreementSnapshot } from "@/lib/booking/agreement-snapshot";

// POST /api/bookings/transition
// body: { bookingId: string, to: "confirmed" | "declined" | "completed" | "cancelled", reason?: string }
//
// Agency-owner endpoint. Replaces the previous client-side direct
// supabase update from AgencyBookingActions so that the renter actually
// gets notified by SMS on confirm / decline, that was silently missing
// when transitions were done client-side.
//
// The Postgres-side "Agency can transition booking" RLS policy is the
// authoritative gate for confirmed/declined/completed. We don't
// double-check ownership here: we just attempt the update with the
// caller's cookie-bound client and let RLS reject it if they're not the
// agency owner. On success we read the (now-updated) booking back via
// the service client to get the joined renter/vehicle/agency data
// needed for the SMS, then fire-and-forget the SMS. SMS failure is
// logged but does not fail the transition, the realtime renter page
// already updates from the WAL stream.
//
// "cancelled" is handled separately (handlePageCancellation below): it's
// the page cancelling a booking the renter already committed to, so it
// needs an explicit party + status + pickup-window check via the service
// client rather than relying on RLS (which would silently no-op on a
// bad caller instead of erroring, and has no notion of "before pickup"),
// plus the strike bookkeeping that makes late cancellations cost the page.

const ALLOWED = new Set(["confirmed", "declined", "completed", "cancelled"] as const);
type AllowedStatus = typeof ALLOWED extends Set<infer T> ? T : never;

const STRIKE_WINDOW_MS = 48 * 60 * 60 * 1000;

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

  const now = new Date().toISOString();

  // Free-launch: when the booking carries no fee, "confirm" goes straight to
  // active (no pay-to-lock-in step) so the renter immediately gets the
  // provider's contact. With a fee, confirm enters the payment window.
  let effective: string = to;
  if (to === "confirmed") {
    const svc = await createServiceClient();
    const { data: feeRow } = await svc.from("bookings").select("booking_fee_lkr").eq("id", body.bookingId).single();
    const fee = (feeRow as { booking_fee_lkr?: number } | null)?.booking_fee_lkr ?? 0;
    if (fee <= 0) effective = "active";
  }

  const update: Record<string, unknown> = { status: effective };
  if (to === "confirmed") {
    update.confirmed_at = now;
    if (effective === "active") update.activated_at = now;
  }
  if (to === "declined")  update.declined_at  = now;
  if (to === "completed") {
    update.completed_at        = now;
    update.return_confirmed_at = now; // agency confirms receipt as it completes
  }

  // Use the caller's cookie-bound client so RLS enforces ownership.
  // Postgres exclusion violation (23P01) bubbles up if the dates clash.
  const { error: updateError } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", body.bookingId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message, code: updateError.code },
      { status: updateError.code === "23P01" ? 409 : 400 },
    );
  }

  // Freeze the digital rental agreement at confirmation. `to === "confirmed"`
  // covers BOTH monetised paths (fee>0 stays in 'confirmed' awaiting payment)
  // and the free-launch path (effective status jumps straight to 'active'),
  // the terms snapshot is identical either way. Runs after the response so
  // the owner's confirm click isn't slowed; the helper is idempotent.
  if (to === "confirmed") {
    runAfterResponse(createAgreementSnapshot(body.bookingId));
  }

  // Fire renter SMS for confirm/decline/complete after the response, the agency
  // shouldn't wait on the renter's SMS/WhatsApp/email. On completion it thanks
  // the renter and links them straight to the review form.
  if (to === "confirmed" || to === "declined" || to === "completed") {
    runAfterResponse((async () => {
      const service = await createServiceClient();
      const { data: full } = await service
        .from("bookings")
        .select("id, renter_id, vehicles(make, model, year, plate_number), agencies(name)")
        .eq("id", body.bookingId)
        .single();

      type Joined = {
        id:        string;
        renter_id: string;
        vehicles:  { make: string; model: string; year: number; plate_number: string | null } | null;
        agencies:  { name: string } | null;
      };
      const row = full as Joined | null;
      if (!row?.renter_id || !row.vehicles || !row.agencies) return;

      const { data: renter } = await service
        .from("profiles")
        .select("phone, email")
        .eq("id", row.renter_id)
        .single();
      const r = renter as { phone?: string | null; email?: string | null } | null;

      const vehicleName  = `${row.vehicles.year} ${row.vehicles.make} ${row.vehicles.model}`;
      const appUrl       = process.env.NEXT_PUBLIC_APP_URL!;
      const vehiclePlate = row.vehicles.plate_number ?? undefined;
      const msgArgs = { bookingId: row.id, vehicleName, vehiclePlate, agencyName: row.agencies.name, appUrl };
      const message =
        to === "confirmed" ? buildRenterConfirmedMessage(msgArgs) :
        to === "declined"  ? buildRenterDeclinedMessage(msgArgs)  :
                             buildRenterCompletedMessage(msgArgs);

      // SMS -> WhatsApp -> Email, so foreign renters who can't receive an SMS
      // still hear back. Skip placeholder emails for the email fallback.
      const realEmail = r?.email && !r.email.endsWith("@phone.drivelink.invalid") ? r.email : null;
      const notified = await notifyCascade({
        phone:        r?.phone ?? undefined,
        smsKey:       "booking_status_renter",
        text:         message,
        email:        realEmail,
        emailSubject: `DriveLink booking ${row.id.slice(0, 8).toUpperCase()}`,
        emailText:    message,
      });
      if (!notified.delivered) console.error("[booking transition] all channels failed", row.id);
    })());
  }

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
    .select(
      "id, renter_id, agency_id, status, start_at, " +
      "agencies(owner_id, name, strike_count, cancellation_count), " +
      "vehicles(make, model, year, plate_number), " +
      "profiles:renter_id(phone, email)",
    )
    .eq("id", bookingId)
    .single();

  type Joined = {
    id: string; renter_id: string; agency_id: string; status: string; start_at: string;
    agencies: { owner_id: string; name: string; strike_count: number; cancellation_count: number } | null;
    vehicles: { make: string; model: string; year: number; plate_number: string | null } | null;
    profiles: { phone: string | null; email: string | null } | null;
  };
  const b = row as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Explicit party check — don't rely on RLS alone here. It reaches the
  // same verdict, but a bad caller against a bare `.update()` would just
  // silently match zero rows and still get a 200, which is a worse
  // failure mode for a "your cancellation went through" action.
  if (b.agencies?.owner_id !== userId) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }
  if (b.status !== "confirmed" && b.status !== "active") {
    return NextResponse.json(
      { error: "Only a confirmed or active booking can be cancelled by the page." },
      { status: 400 },
    );
  }
  const startMs = new Date(b.start_at).getTime();
  if (startMs <= Date.now()) {
    return NextResponse.json(
      { error: "This booking's pickup time has already passed — use dispute reporting instead." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const trimmedReason = reason?.trim();
  const cancellationReason = trimmedReason
    ? `Cancelled by the Rental Page: ${trimmedReason}`
    : "Cancelled by the Rental Page";

  const { error: updateError } = await service
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: now, cancellation_reason: cancellationReason, cancelled_by: "page" })
    .eq("id", bookingId);
  if (updateError) {
    console.error("[booking transition] page cancel failed", bookingId, updateError);
    return NextResponse.json({ error: "Couldn't cancel the booking. Try again." }, { status: 500 });
  }

  // Strike bookkeeping. cancellation_count is recomputed by the
  // update_agency_reliability() trigger, which counts cancelled bookings
  // with cancelled_by='page' (fixed in migration 053), so the status
  // update above already ticks it. Only strike_count needs a manual
  // increment, and only for the renter-trust-killing case: cancelling
  // inside the 48h pre-pickup window.
  const withinStrikeWindow = startMs - Date.now() <= STRIKE_WINDOW_MS;
  if (withinStrikeWindow) {
    const { error: agencyError } = await service
      .from("agencies")
      .update({ strike_count: (b.agencies?.strike_count ?? 0) + 1 })
      .eq("id", b.agency_id);
    if (agencyError) console.error("[booking transition] agency strike update failed", b.agency_id, agencyError);
  }

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

  // Notify the renter after the response, same cascade pattern as every
  // other transition. Points at the marketplace, not the booking's own
  // page, since there's nothing more for the renter to act on there.
  runAfterResponse((async () => {
    const appUrl       = process.env.NEXT_PUBLIC_APP_URL!;
    const vehicleName  = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "your vehicle";
    const vehiclePlate = b.vehicles?.plate_number ?? undefined;
    const message = buildRenterPageCancelledMessage({
      bookingId:  b.id,
      vehicleName,
      vehiclePlate,
      agencyName: b.agencies?.name ?? "",
      appUrl,
    });
    const realEmail = b.profiles?.email && !b.profiles.email.endsWith("@phone.drivelink.invalid") ? b.profiles.email : null;
    const notified = await notifyCascade({
      phone:        b.profiles?.phone ?? undefined,
      smsKey:       "booking_status_renter",
      text:         message,
      email:        realEmail,
      emailSubject: "Your DriveLink booking was cancelled",
      emailText:    message,
    });
    if (!notified.delivered) console.error("[booking transition] page-cancel notify failed", b.id);
  })());

  return NextResponse.json({ ok: true, newStatus: "cancelled" });
}
