import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calcBookingPriceByDays, billableDaysBetween, toDateTime } from "@/lib/bookings/pricing";
import { LAUNCH_BOOKING_CONFIRMATION_FEE_LKR } from "@/lib/payments/model";
import { kickNotificationOutbox } from "@/lib/notification-outbox";
import {
  RENTER_BOOKINGS_SELECT,
  type RenterBookingRow,
} from "@/components/bookings/renter-bookings-query";
import {
  assessSelfDriveEligibility,
  type EligibleDriver,
} from "@/lib/booking/self-drive-eligibility";
import { listingPublicationProblem } from "@/lib/vehicles/trust";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Rental Page rows contain private contact and operational fields. Keep the
  // browser outside that table and return only this renter's safe booking view.
  const service = await createServiceClient();
  const { data, error } = await service
    .from("bookings")
    .select(RENTER_BOOKINGS_SELECT)
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load renter bookings", error);
    return NextResponse.json({ error: "Could not refresh bookings" }, { status: 500 });
  }

  return NextResponse.json(
    { bookings: (data ?? []) as unknown as RenterBookingRow[] },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Booking requests are accepted only after identity verification. The
  // service-side gate below is authoritative; hiding the form is only UX.

  const body = await req.json();
  // agency_id is intentionally NOT trusted from the client, we derive it from
  // the vehicle below. Only the vehicle + dates are required.
  const { vehicle_id, start_date, end_date } = body;
  // Chosen drive mode. The owner inspects the original licence, and any permit
  // a foreign licence needs, at the handover.
  const requestedMode = body.rental_mode === "self_drive" || body.rental_mode === "with_driver" ? body.rental_mode : null;
  // Times are optional; default to 10:00 handover if the client omits them.
  const start_time = typeof body.start_time === "string" && body.start_time ? body.start_time.slice(0, 5) : "10:00";
  const end_time   = typeof body.end_time   === "string" && body.end_time   ? body.end_time.slice(0, 5)   : "10:00";

  if (!vehicle_id || !start_date || !end_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const startAt = toDateTime(start_date, start_time); // "YYYY-MM-DDTHH:mm"
  const endAt   = toDateTime(end_date, end_time);
  if (billableDaysBetween(startAt, endAt) < 1) {
    return NextResponse.json({ error: "Return must be after pick-up." }, { status: 400 });
  }

  // Lead-time guard (server-authoritative): pick-up must be >= 24h from now, and
  // never in the past. Sri Lanka is UTC+05:30 (no DST), so anchor the local
  // pick-up datetime to +05:30 for a correct epoch wherever the worker runs.
  const startEpoch = Date.parse(`${start_date}T${start_time}:00+05:30`);
  if (!Number.isFinite(startEpoch) || startEpoch < Date.now() + 24 * 3_600_000) {
    return NextResponse.json(
      { error: "Pick-up must be at least 24 hours from now. Choose a later time to send an online request." },
      { status: 400 },
    );
  }

  // Use service client for insert so RLS doesn't block server-side ops
  const service = await createServiceClient();

  // Fetch the vehicle (canonical rates + its REAL owner) and the renter.
  // We never trust the client-supplied price OR agency_id, the agency is
  // derived from the vehicle row so a request can't be mis-attributed.
  const [{ data: vehicle }, { data: renter }] = await Promise.all([
    service.from("vehicles").select("agency_id, status, plate_number, photos, rejection_reason, listing_authority_basis, listing_authority_declared, listing_authority_confirmed_at, listing_authority_confirmed_by, listing_authority_declaration_version, daily_rate_lkr, weekly_rate_lkr, monthly_rate_lkr, deposit_lkr, self_drive, with_driver, min_rental_days, max_rental_days, min_renter_age, min_license_years").eq("id", vehicle_id).single(),
    service.from("profiles").select("kyc_status, is_blacklisted, booking_frozen, date_of_birth").eq("id", user.id).single(),
  ]);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const v = vehicle as {
    agency_id:        string;
    status:           string;
    plate_number:     string | null;
    photos:           string[] | null;
    rejection_reason: string | null;
    listing_authority_basis: string | null;
    listing_authority_declared: boolean;
    listing_authority_confirmed_at: string | null;
    listing_authority_confirmed_by: string | null;
    listing_authority_declaration_version: string | null;
    daily_rate_lkr:   number;
    weekly_rate_lkr:  number | null;
    monthly_rate_lkr: number | null;
    deposit_lkr:      number | null;
    self_drive:       boolean;
    with_driver:      boolean;
    min_rental_days:  number | null;
    max_rental_days:  number | null;
    min_renter_age:   number | null;
    min_license_years:number | null;
  };

  // Only bookable while the listing is live. Blocks direct-API attempts to
  // book unlisted / under-maintenance / pending-review vehicles.
  if (v.status !== "available") {
    return NextResponse.json({ error: "This vehicle isn't available for booking." }, { status: 409 });
  }
  if (listingPublicationProblem(v)) {
    return NextResponse.json({ error: "This vehicle isn't available for booking." }, { status: 409 });
  }

  if (!v.self_drive && !v.with_driver) {
    return NextResponse.json(
      { error: "This listing is missing a rental mode. The Rental Page needs to correct it before it can be booked." },
      { status: 409 },
    );
  }

  // Verified renters only. Quality over quantity: an owner should never
  // receive a request from someone whose identity we haven't confirmed - 
  // it's the platform's core promise. 'pending' is called out separately so
  // a returning renter whose Didit webhook is still in flight sees "give it
  // a moment" instead of being pushed to re-verify.
  const kyc = (renter as { kyc_status?: string } | null)?.kyc_status;
  if (kyc === "pending") {
    return NextResponse.json(
      { error: "Your identity check is still being reviewed. This usually takes a minute. Please try again shortly.", verificationPending: true },
      { status: 403 },
    );
  }
  if (kyc !== "verified") {
    return NextResponse.json(
      { error: "Verify your identity to send this request.", needsVerification: true },
      { status: 403 },
    );
  }

  // Blacklisted renters can't create bookings.
  if ((renter as { is_blacklisted?: boolean } | null)?.is_blacklisted) {
    return NextResponse.json({ error: "Your account can't make bookings. Contact support." }, { status: 403 });
  }

  // Frozen while a rental is 24h+ overdue (late-return ladder). Lifted
  // automatically by trg_clear_booking_freeze when that booking completes.
  if ((renter as { booking_frozen?: boolean } | null)?.booking_frozen) {
    return NextResponse.json(
      { error: "Your account is paused after DriveLink reviewed an unreturned rental. Resolve that booking or contact support before booking again." },
      { status: 403 },
    );
  }

  // BOOK-011: resolve the drive mode this booking is for. If the vehicle offers
  // only one mode, that's it; if it offers both, the renter must have chosen.
  let effectiveMode: "self_drive" | "with_driver" | null =
    v.self_drive && !v.with_driver ? "self_drive" :
    v.with_driver && !v.self_drive ? "with_driver" :
    requestedMode;
  if (v.self_drive && v.with_driver && !effectiveMode) {
    return NextResponse.json({ error: "Choose self-drive or with-driver for this booking." }, { status: 400 });
  }
  // Guard against a mode the vehicle doesn't actually offer.
  if (effectiveMode === "self_drive" && !v.self_drive) effectiveMode = "with_driver";
  if (effectiveMode === "with_driver" && !v.with_driver) effectiveMode = "self_drive";

  const isSelfDrive = effectiveMode === "self_drive";
  let approvedDriver: EligibleDriver | null = null;

  // Self-drive: DriveLink checks the one thing its records can prove, the age
  // on the renter's verified identity document. The licence itself, and any
  // permit a foreign licence needs, is inspected by the owner at handover.
  if (isSelfDrive) {
    const eligibility = assessSelfDriveEligibility(
      { date_of_birth: (renter as { date_of_birth?: string | null } | null)?.date_of_birth ?? null },
      { minRenterAge: v.min_renter_age },
      start_date,
    );
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.message, eligibilityCode: eligibility.code },
        { status: 403 },
      );
    }

    // Keep the age at pickup; the Rental Page never receives the birth date.
    approvedDriver = eligibility.driver;
  }

  // Authoritative agency id, from the vehicle, not the request body.
  const realAgencyId = v.agency_id;

  const { data: agency } = await service
    .from("agencies")
    .select("id, owner_id, is_verified, whatsapp_verified_at, deactivated_at, is_blocked, deleted_at, owner:profiles!owner_id(kyc_status, is_blacklisted, deleted_at)")
    .eq("id", realAgencyId)
    .single();

  if (!agency) {
    return NextResponse.json({ error: "Vehicle or Rental Page not found" }, { status: 404 });
  }

  const a = agency as unknown as {
    id:                              string;
    owner_id:                        string;
    is_verified:                     boolean;
    whatsapp_verified_at:            string | null;
    deactivated_at: string | null;
    is_blocked: boolean;
    deleted_at: string | null;
    owner: { kyc_status: string; is_blacklisted: boolean; deleted_at: string | null } | null;
  };

  // PAGE-005: a paused page never takes new bookings, even if a stray vehicle
  // slipped back to 'available' (e.g. approved while paused).
  const ownerEligible = a.owner?.kyc_status === "verified"
    && a.owner.is_blacklisted !== true
    && !a.owner.deleted_at;
  if (!a.is_verified || !a.whatsapp_verified_at || a.deactivated_at || a.is_blocked || a.deleted_at || !ownerEligible) {
    return NextResponse.json({ error: "This vehicle isn't available for booking." }, { status: 409 });
  }

  // ── Lead-quality guards (C2): keep requests high-intent, not scattershot ──
  // Pull the renter's currently in-flight bookings once and derive the caps.
  const OPEN_STATUSES = ["requested", "pending_confirmation", "confirmed", "payment_pending"];
  const { data: openRows } = await service
    .from("bookings")
    .select("id, vehicle_id")
    .eq("renter_id", user.id)
    .in("status", OPEN_STATUSES);
  const open = (openRows ?? []) as { id: string; vehicle_id: string }[];

  if (open.some((r) => r.vehicle_id === vehicle_id)) {
    return NextResponse.json({ error: "You already have a request in progress for this vehicle." }, { status: 409 });
  }
  if (open.length >= 4) {
    return NextResponse.json(
      { error: "You have several requests in progress. Wait for those to be confirmed or closed before sending more." },
      { status: 429 },
    );
  }
  // Burst rate-limit: cap new requests per rolling 24h (counts every attempt,
  // including ones the renter cancelled, so create+cancel loops are caught).
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: recentCount } = await service
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("renter_id", user.id)
    .gt("created_at", since24h);
  if ((recentCount ?? 0) >= 8) {
    return NextResponse.json({ error: "Daily request limit reached. Please try again tomorrow." }, { status: 429 });
  }

  // ── Expire ghost requests (C3) ──
  // A pending request the agency never acted on shouldn't block this slot
  // forever. Decline (NOT cancel) overlapping pendings older than 48h, using
  // 'declined' avoids the renter-reliability penalty that 'cancelled' triggers.
  const staleCutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  await service
    .from("bookings")
    .update({
      status:              "declined",
      declined_at:         new Date().toISOString(),
      cancellation_reason: "Request expired, agency did not respond in time",
    })
    .eq("vehicle_id", vehicle_id)
    .eq("status", "pending_confirmation")
    .lt("created_at", staleCutoff)
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  // Decision 2: requests STACK. Only a COMMITTED booking (confirmed / paid /
  // active / disputed) blocks the dates - pending requests do not, so several
  // renters can request the same dates and the owner picks one (the winning
  // confirmation auto-declines the overlapping pendings via the DB trigger).
  // A maintenance block still blocks.
  //   Bookings: time-aware overlap, existing.start_at < new.end_at AND
  //             existing.end_at > new.start_at (allows back-to-back same day).
  const [{ data: bookingConflicts }, { data: blockConflicts }] = await Promise.all([
    service
      .from("bookings")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .in("status", ["confirmed", "payment_pending", "active", "disputed"])
      .lt("start_at", endAt)
      .gt("end_at", startAt)
      .limit(1),
    service
      .from("vehicle_blocks")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .lt("start_date", end_date)
      .gt("end_date", start_date)
      .limit(1),
  ]);

  if (bookingConflicts && bookingConflicts.length > 0) {
    return NextResponse.json(
      { error: "These dates are already booked. Try different dates." },
      { status: 409 }
    );
  }
  if (blockConflicts && blockConflicts.length > 0) {
    return NextResponse.json(
      { error: "The agency has marked these dates as unavailable. Try different dates." },
      { status: 409 }
    );
  }

  // Strict 24-hour billable days (matches the DB's generated total_days),
  // then daily/monthly pricing on that day count.
  const days = billableDaysBetween(startAt, endAt);

  // BOOK-012: enforce the listing's own min/max rental length server-side, so
  // the owner doesn't have to manually reject a too-short or too-long request.
  const minDays = v.min_rental_days ?? 1;
  if (days < minDays) {
    return NextResponse.json(
      { error: `This vehicle has a minimum rental of ${minDays} day${minDays === 1 ? "" : "s"}.` },
      { status: 409 },
    );
  }
  if (v.max_rental_days && days > v.max_rental_days) {
    return NextResponse.json(
      { error: `This vehicle has a maximum rental of ${v.max_rental_days} day${v.max_rental_days === 1 ? "" : "s"}.` },
      { status: 409 },
    );
  }

  const { subtotal } = calcBookingPriceByDays(days, v.daily_rate_lkr, v.monthly_rate_lkr, v.weekly_rate_lkr);

  // Create the booking. total_days is a generated (time-aware) column, so we
  // don't set it, the DB derives it from the dates + times.
  const { data: booking, error: insertError } = await service
    .from("bookings")
    .insert({
      vehicle_id,
      agency_id: realAgencyId,
      renter_id: user.id,
      status: "pending_confirmation",
      start_date,
      end_date,
      start_time,
      end_time,
      daily_rate_lkr:  v.daily_rate_lkr,
      subtotal_lkr:    subtotal,
      // Launch safety: a future fee needs a payment gateway, a new database
      // migration, and a new checkout flow. An admin toggle cannot turn on a
      // manual bank-transfer path by accident.
      booking_fee_lkr: LAUNCH_BOOKING_CONFIRMATION_FEE_LKR,
      // BOOK-013: snapshot the deposit at request time so it can't be raised
      // before the owner accepts.
      deposit_lkr:     v.deposit_lkr ?? null,
      // Self-drive snapshot. The licence is inspected at pickup, so no licence
      // facts are recorded here; the licence columns stay for older bookings.
      rental_mode:            effectiveMode,
      is_foreign_renter:      false,
      driver_age_at_pickup:   approvedDriver?.ageAtPickup ?? null,
    })
    .select("id")
    .single();

  if (insertError || !booking) {
    console.error("[booking create]", insertError);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  // The insert trigger stored the page notice in the same transaction.
  kickNotificationOutbox(service);

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
