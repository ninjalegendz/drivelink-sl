import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildAgencyPingMessage } from "@/lib/sms/messages";
import { calcBookingPriceByDays, billableDaysBetween, toDateTime } from "@/lib/bookings/pricing";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Book-before-ID: renters can send a request without completing KYC first
  // (removes the biggest drop-off). Identity verification is required later,
  // the provider's contact details only unlock once the renter is verified
  // AND the provider has confirmed (gated on the booking detail page).

  const body = await req.json();
  // agency_id is intentionally NOT trusted from the client, we derive it from
  // the vehicle below. Only the vehicle + dates are required.
  const { vehicle_id, start_date, end_date } = body;
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
      { error: "Pick-up must be at least 24 hours from now. For urgent bookings, contact us on WhatsApp." },
      { status: 400 },
    );
  }

  // Use service client for insert so RLS doesn't block server-side ops
  const service = await createServiceClient();

  // Fetch the vehicle (canonical rates + its REAL owner) and the renter.
  // We never trust the client-supplied price OR agency_id, the agency is
  // derived from the vehicle row so a request can't be mis-attributed.
  const [{ data: vehicle }, { data: renter }] = await Promise.all([
    service.from("vehicles").select("agency_id, status, make, model, year, plate_number, daily_rate_lkr, monthly_rate_lkr").eq("id", vehicle_id).single(),
    service.from("profiles").select("full_name, is_blacklisted, booking_frozen").eq("id", user.id).single(),
  ]);

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const v = vehicle as {
    agency_id:        string;
    status:           string;
    make:             string;
    model:            string;
    year:             number;
    plate_number:     string | null;
    daily_rate_lkr:   number;
    monthly_rate_lkr: number | null;
  };

  // Only bookable while the listing is live. Blocks direct-API attempts to
  // book unlisted / under-maintenance / pending-review vehicles.
  if (v.status !== "available") {
    return NextResponse.json({ error: "This vehicle isn't available for booking." }, { status: 409 });
  }

  // Blacklisted renters can't create bookings.
  if ((renter as { is_blacklisted?: boolean } | null)?.is_blacklisted) {
    return NextResponse.json({ error: "Your account can't make bookings. Contact support." }, { status: 403 });
  }

  // Frozen while a rental is 24h+ overdue (late-return ladder). Lifted
  // automatically by trg_clear_booking_freeze when that booking completes.
  if ((renter as { booking_frozen?: boolean } | null)?.booking_frozen) {
    return NextResponse.json(
      { error: "Your account is frozen because a rental is seriously overdue. Resolve it to book again." },
      { status: 403 },
    );
  }

  // Authoritative agency id, from the vehicle, not the request body.
  const realAgencyId = v.agency_id;

  const { data: agency } = await service
    .from("agencies")
    .select("id, name, whatsapp_number, sms_notifications_enabled, whatsapp_notifications_enabled, profiles!owner_id(email)")
    .eq("id", realAgencyId)
    .single();

  if (!agency) {
    return NextResponse.json({ error: "Vehicle or agency not found" }, { status: 404 });
  }

  const a = agency as unknown as {
    id:                              string;
    name:                            string;
    whatsapp_number:                 string;
    sms_notifications_enabled:       boolean;
    whatsapp_notifications_enabled:  boolean;
    profiles:                        { email: string | null } | null;
  };

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

  // Reject if the window clashes with any in-flight booking (incl. pending
  // requests) OR an agency-set maintenance block. The slot only frees when
  // the existing booking moves to declined/cancelled.
  //   Bookings: time-aware overlap, existing.start_at < new.end_at AND
  //             existing.end_at > new.start_at (allows back-to-back same day).
  //   Blocks:   whole-day maintenance, date overlap.
  const [{ data: bookingConflicts }, { data: blockConflicts }] = await Promise.all([
    service
      .from("bookings")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .in("status", ["requested", "pending_confirmation", "confirmed", "payment_pending", "active", "disputed"])
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
  const { subtotal } = calcBookingPriceByDays(days, v.daily_rate_lkr, v.monthly_rate_lkr);

  // Booking fee comes from platform settings, 0 during the free-launch period
  // (no payment step), a positive value once monetization is switched on.
  const { data: settingsRow } = await service.from("platform_settings").select("booking_fee_lkr").eq("id", true).single();
  const bookingFee = Math.max(0, (settingsRow as { booking_fee_lkr?: number } | null)?.booking_fee_lkr ?? 0);

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
      booking_fee_lkr: bookingFee,
    })
    .select("id")
    .single();

  if (insertError || !booking) {
    console.error("[booking create]", insertError);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  // Fire SMS ping to agency (non-blocking, don't fail the booking if SMS fails).
  // Sent via text.lk; the agency confirms by clicking through to the dashboard.
  const vehicleName = `${v.year} ${v.make} ${v.model}`;
  const renterName  = renter?.full_name ?? "Verified Renter";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Notify the agency via the cascade: SMS -> WhatsApp -> Email (first success
  // wins). The realtime dashboard toast fires regardless. Non-blocking.
  const ref      = booking.id.slice(0, 8).toUpperCase();
  const pingText = buildAgencyPingMessage({
    bookingId:    booking.id,
    renterName,
    vehicleName,
    vehiclePlate: v.plate_number ?? undefined,
    startDate:    `${start_date} ${start_time}`,
    endDate:      `${end_date} ${end_time}`,
    totalDays:    days,
    appUrl,
  });

  // Don't make the renter wait on SMS/WhatsApp/email, fire it after the
  // response. The realtime dashboard toast fires regardless.
  runAfterResponse(
    notifyCascade({
      phone:        a.whatsapp_number,
      smsKey:       "new_booking_agency",
      text:         pingText,
      email:        a.profiles?.email ?? null,
      emailSubject: `New booking ${ref}, ${vehicleName}`,
      emailText:    pingText,
    }).then((notified) => {
      if (!notified.delivered) console.error("[booking notify] all channels failed for", booking.id);
    }),
  );

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
