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
import { ensureAgreementSnapshot } from "@/lib/booking/agreement-snapshot";
import { canActOnAgency } from "@/lib/pages/access";

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

const ALLOWED = new Set(["confirmed", "active", "declined", "completed", "cancelled"] as const);
type AllowedStatus = typeof ALLOWED extends Set<infer T> ? T : never;

// Decision 3: "confirmed" means reserved (not started). The rental only becomes
// "active" when the owner starts it at pickup. Per-target current-state gate so
// a stale control can't jump a booking into an impossible state (audit BOOK-001).
const VALID_FROM: Record<Exclude<AllowedStatus, "cancelled">, string[]> = {
  confirmed: ["pending_confirmation"],
  active:    ["confirmed"],
  declined:  ["pending_confirmation"],
  completed: ["active"],
};

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

  // bookings is locked to server-side writes, so ownership is enforced here
  // explicitly (was previously the "Agency can transition booking" RLS gate):
  // the caller must own the page, and the booking must be in a live,
  // transitionable state. The write then runs on the service client.
  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, status, start_at, vehicle_id, agency_id, agencies!inner(owner_id)")
    .eq("id", body.bookingId)
    .single();
  const bk = bookingRow as {
    id: string;
    status: string;
    start_at: string | null;
    vehicle_id: string;
    agency_id: string;
    agencies: { owner_id: string } | null;
  } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await canActOnAgency(service, user.id, bk.agency_id))) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }
  if (!VALID_FROM[to].includes(bk.status)) {
    return NextResponse.json({ error: `Can't do that from '${bk.status}'.` }, { status: 409 });
  }

  // Starting the rental ("active") is a pickup action - don't let it happen
  // weeks early. Allow it from a day before the pickup date onward.
  if (to === "active" && bk.start_at) {
    const EARLY_GRACE = 24 * 3600_000;
    if (Date.now() < new Date(bk.start_at).getTime() - EARLY_GRACE) {
      return NextResponse.json(
        { error: "It's too early to start this rental. You can start it from the day before pickup." },
        { status: 409 },
      );
    }
  }

  // BUILD 1 - mandatory inspection gates (TRUST-001). A rental can't be started
  // without a recorded PICKUP inspection, and can't be completed without a
  // RETURN inspection. This is DriveLink's flagship deposit-dispute protection,
  // so it's enforced here (not just in the UI). Admins keep an audited emergency
  // override via /api/admin/bookings/transition.
  async function inspectionExists(phase: "pickup" | "return"): Promise<boolean> {
    const { count } = await service
      .from("booking_inspections")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", body.bookingId)
      .eq("phase", phase);
    return (count ?? 0) > 0;
  }
  if (to === "active" && !(await inspectionExists("pickup"))) {
    return NextResponse.json(
      { error: "Record the pickup inspection (photos, odometer, fuel) before starting the rental." },
      { status: 409 },
    );
  }
  if (to === "completed" && !(await inspectionExists("return"))) {
    return NextResponse.json(
      { error: "Record the return inspection before completing the booking." },
      { status: 409 },
    );
  }

  const update: Record<string, unknown> = { status: to };
  if (to === "confirmed") update.confirmed_at = now;   // reserved, not started
  if (to === "active")    update.activated_at = now;   // rental starts at pickup
  if (to === "declined")  update.declined_at  = now;
  if (to === "completed") {
    update.completed_at        = now;
    update.return_confirmed_at = now; // agency confirms receipt as it completes
  }

  // Service client (bookings has no browser UPDATE grant). The Postgres
  // exclusion violation (23P01) still bubbles up if the dates clash.
  const { error: updateError } = await service
    .from("bookings")
    .update(update)
    .eq("id", body.bookingId)
    .eq("status", bk.status);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message, code: updateError.code },
      { status: updateError.code === "23P01" ? 409 : 400 },
    );
  }

  // Freeze the digital rental agreement at confirmation (reservation). TRUST-006:
  // awaited (not fire-and-forget) so the snapshot is guaranteed to exist before
  // we report success - the renter can open Agreement immediately after. The
  // helper is idempotent and retries once; a hard failure is logged but doesn't
  // block the confirmation the owner already committed.
  if (to === "confirmed") {
    await ensureAgreementSnapshot(body.bookingId);
  }

  // Decision 2 follow-up: confirming auto-declines the OTHER pending requests
  // whose dates overlap (auto_decline_overlapping_pending trigger). Tell those
  // renters their dates went to someone else so a silent decline doesn't leave
  // them hanging. Matches the trigger's reason + a fresh declined_at.
  if (to === "confirmed") {
    runAfterResponse((async () => {
      const svc = await createServiceClient();
      const { data: losers } = await svc
        .from("bookings")
        .select("id, renter_id, start_date, end_date, vehicles(make, model, year)")
        .eq("vehicle_id", bk.vehicle_id)
        .eq("status", "declined")
        .eq("cancellation_reason", "Dates booked by another renter")
        .gt("declined_at", new Date(Date.now() - 60_000).toISOString());
      const rows = (losers ?? []) as unknown as {
        renter_id: string; start_date: string; end_date: string;
        vehicles: { make: string; model: string; year: number } | null;
      }[];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
      for (const l of rows) {
        const { data: r } = await svc.from("profiles").select("phone, email").eq("id", l.renter_id).single();
        const rr = r as { phone?: string | null; email?: string | null } | null;
        const vname = l.vehicles ? `${l.vehicles.year} ${l.vehicles.make} ${l.vehicles.model}` : "that vehicle";
        const realEmail = rr?.email && !rr.email.endsWith("@phone.drivelink.invalid") ? rr.email : null;
        const text = `DriveLink: the ${vname} you requested (${l.start_date} to ${l.end_date}) was just booked by another renter. Browse other options: ${appUrl}/vehicles`;
        await notifyCascade({
          phone: rr?.phone ?? undefined, smsKey: "booking_status_renter", text,
          email: realEmail, emailSubject: "Those dates were just booked", emailText: text,
        });
      }
    })());
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

  // Explicit party check - don't rely on RLS alone here. It reaches the
  // same verdict, but a bad caller against a bare `.update()` would just
  // silently match zero rows and still get a 200, which is a worse
  // failure mode for a "your cancellation went through" action.
  if (!(await canActOnAgency(service, userId, b.agency_id))) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
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

  const { error: updateError } = await service
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: now, cancellation_reason: cancellationReason, cancelled_by: isNoShow ? "system" : "page" })
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
  const withinStrikeWindow = !isNoShow && startMs - Date.now() <= STRIKE_WINDOW_MS;
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
