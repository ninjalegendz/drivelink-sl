import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  buildRenterConfirmedMessage,
  buildRenterDeclinedMessage,
  buildRenterCompletedMessage,
} from "@/lib/sms/messages";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import {
  buildAgreementTerms,
  AGREEMENT_TEMPLATE_VERSION,
  type AgreementBookingInput,
  type AgreementVehicleInput,
  type AgreementPageInput,
  type AgreementRenterInput,
} from "@/lib/booking/agreement";

// POST /api/bookings/transition
// body: { bookingId: string, to: "confirmed" | "declined" | "completed" }
//
// Agency-owner endpoint. Replaces the previous client-side direct
// supabase update from AgencyBookingActions so that the renter actually
// gets notified by SMS on confirm / decline, that was silently missing
// when transitions were done client-side.
//
// The Postgres-side "Agency can transition booking" RLS policy is the
// authoritative gate. We don't double-check ownership here: we just
// attempt the update with the caller's cookie-bound client and let RLS
// reject it if they're not the agency owner. On success we read the
// (now-updated) booking back via the service client to get the joined
// renter/vehicle/agency data needed for the SMS, then fire-and-forget
// the SMS. SMS failure is logged but does not fail the transition,
// the realtime renter page already updates from the WAL stream.

const ALLOWED = new Set(["confirmed", "declined", "completed"] as const);
type AllowedStatus = typeof ALLOWED extends Set<infer T> ? T : never;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    bookingId: string;
    to:        string;
  }>;
  if (!body.bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  if (!body.to || !ALLOWED.has(body.to as AllowedStatus)) {
    return NextResponse.json({ error: "Invalid transition target" }, { status: 400 });
  }
  const to = body.to as AllowedStatus;

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
  // the owner's confirm click isn't slowed; booking_agreements.booking_id is
  // UNIQUE, so a duplicate insert (double-click, retry) is ignored, making
  // this idempotent. Admin transitions (/api/admin/bookings/transition) are
  // deliberately not covered here.
  if (to === "confirmed") {
    const bookingId = body.bookingId; // non-optional local for the closure
    runAfterResponse((async () => {
      const service = await createServiceClient();
      const { data: agRow } = await service
        .from("bookings")
        .select(
          "id, renter_id, start_date, end_date, start_time, end_time, start_at, end_at, " +
          "total_days, daily_rate_lkr, subtotal_lkr, deposit_lkr, " +
          "vehicles(make, model, year, plate_number, fuel_type, insurance_type, fuel_policy, deposit_lkr, " +
          "monthly_rate_lkr, weekly_rate_lkr, included_km_per_day, unlimited_km, mileage_limit, extra_mileage_lkr, " +
          "refuel_fee_lkr, cleaning_fee_lkr, late_fee_per_hour_lkr, self_drive, with_driver, per_km_rate_lkr, " +
          "tolls_included, driver_bata_lkr, smoking_allowed, pets_allowed, ride_hail_allowed, second_driver_allowed, " +
          "restricted_use, has_gps_tracker, has_etc_tag, min_renter_age, min_license_years), " +
          "agencies(name, page_type, whatsapp_number)",
        )
        .eq("id", bookingId)
        .single();

      const ag = agRow as unknown as
        | (AgreementBookingInput & {
            renter_id: string;
            vehicles:  AgreementVehicleInput | null;
            agencies:  AgreementPageInput | null;
          })
        | null;
      if (!ag?.vehicles || !ag.agencies) return;

      const { data: renterRow } = await service
        .from("profiles")
        .select("full_name, nic_number")
        .eq("id", ag.renter_id)
        .single();
      const renterProfile = renterRow as AgreementRenterInput | null;
      if (!renterProfile) return;

      const terms = buildAgreementTerms({
        booking:       ag,
        vehicle:       ag.vehicles,
        page:          ag.agencies,
        renterProfile,
      });

      const { error: agreementError } = await service.from("booking_agreements").insert({
        booking_id:       bookingId,
        template_version: AGREEMENT_TEMPLATE_VERSION,
        terms,
      });
      // 23505 = unique violation on booking_id: the snapshot already exists
      // (retry / double confirm), which is exactly what we want, keep it.
      if (agreementError && agreementError.code !== "23505") {
        console.error("[booking transition] agreement snapshot failed", bookingId, agreementError);
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
