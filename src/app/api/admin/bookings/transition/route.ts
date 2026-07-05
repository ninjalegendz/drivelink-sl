import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import {
  buildRenterConfirmedMessage,
  buildRenterDeclinedMessage,
  buildRenterCancelledMessage,
  buildRenterCompletedMessage,
  buildAgencyCompletedMessage,
} from "@/lib/sms/messages";

// POST /api/admin/bookings/transition
// body: { bookingId: string, to: "confirmed" | "declined" | "completed" | "cancelled", note?: string }
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

const ALLOWED_TRANSITIONS = new Set(["confirmed", "declined", "completed", "cancelled"] as const);
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
    bookingId: string;
    to:        string;
    note:      string;
  }>;

  if (!body.bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  if (!body.to || !ALLOWED_TRANSITIONS.has(body.to as AllowedStatus)) {
    return NextResponse.json({ error: "Invalid transition target" }, { status: 400 });
  }
  const to = body.to as AllowedStatus;
  // Capture as a non-optional local, property narrowing on `body` doesn't carry
  // into the runAfterResponse closure below.
  const bookingId = body.bookingId;

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

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: to };
  if (to === "confirmed") update.confirmed_at = now;
  if (to === "declined")  update.declined_at  = now;
  if (to === "completed") { update.completed_at = now; update.return_confirmed_at = now; }
  if (to === "cancelled") update.cancelled_at = now;

  const { error: updateError } = await service
    .from("bookings")
    .update(update)
    .eq("id", body.bookingId);

  if (updateError) {
    console.error("[admin booking transition]", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
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

  // Renter SMS for confirm / decline / cancel / complete. On completion the
  // renter gets a thanks + review link, and the agency is nudged to rate the
  // renter. Same content as the agency-side endpoint, plus the vehicle plate
  // so two same-named cars are always distinguishable.
  if (to === "confirmed" || to === "declined" || to === "cancelled" || to === "completed") {
    runAfterResponse((async () => {
      const { data: joined } = await service
        .from("bookings")
        .select("id, vehicles(make, model, year, plate_number), agencies(name, whatsapp_number)")
        .eq("id", bookingId)
        .single();
      type Joined = {
        id:       string;
        vehicles: { make: string; model: string; year: number; plate_number: string | null } | null;
        agencies: { name: string; whatsapp_number: string | null } | null;
      };
      const row = joined as Joined | null;

      const { data: renter } = await service
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", prev.renter_id)
        .single();
      const rt = renter as { full_name?: string | null; phone?: string | null; email?: string | null } | null;

      if (!row?.vehicles || !row.agencies) return;

      const vehicleName  = `${row.vehicles.year} ${row.vehicles.make} ${row.vehicles.model}`;
      const vehiclePlate = row.vehicles.plate_number ?? undefined;
      const appUrl       = process.env.NEXT_PUBLIC_APP_URL!;
      const msgArgs = {
        bookingId,
        vehicleName,
        vehiclePlate,
        agencyName: row.agencies.name,
        appUrl,
      };
      const message =
        to === "confirmed" ? buildRenterConfirmedMessage(msgArgs) :
        to === "declined"  ? buildRenterDeclinedMessage(msgArgs)  :
        to === "completed" ? buildRenterCompletedMessage(msgArgs) :
                             buildRenterCancelledMessage(msgArgs);

      const realEmail = rt?.email && !rt.email.endsWith("@phone.drivelink.invalid") ? rt.email : null;
      const notified = await notifyCascade({
        phone:        rt?.phone ?? undefined,
        smsKey:       "admin_booking_status_renter",
        text:         message,
        email:        realEmail,
        emailSubject: `DriveLink booking ${bookingId.slice(0, 8).toUpperCase()}`,
        emailText:    message,
      });
      if (!notified.delivered) console.error("[admin booking transition] all channels failed", body.bookingId);

      // On completion, also nudge the agency to rate the renter.
      if (to === "completed" && row.agencies.whatsapp_number) {
        const agencyMsg = buildAgencyCompletedMessage({
          bookingId,
          vehicleName,
          vehiclePlate,
          renterName: rt?.full_name ?? "your renter",
          appUrl,
        });
        await notifyCascade({
          phone:  row.agencies.whatsapp_number,
          smsKey: "new_booking_agency",
          text:   agencyMsg,
        });
      }
    })());
  }

  return NextResponse.json({ ok: true, previousStatus: prev.status, newStatus: to });
}
