import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { sendSmsIfEnabled } from "@/lib/sms/gate";
import { notifyCascade } from "@/lib/notify";
import { buildRenterCompletedMessage, buildAgencyCompletedMessage } from "@/lib/sms/messages";
import { sweepOrphanStorage } from "@/lib/storage/sweep";
import { formatLKR } from "@/lib/vehicles/format";

export const dynamic = "force-dynamic";

// Vercel Cron runs this every 15 minutes (see vercel.json). Auths via
// the Authorization: Bearer <CRON_SECRET> header that Vercel adds
// automatically when CRON_SECRET is set in env.
//
// What it does:
//   1. Find bookings with status='confirmed', no slip_url, where
//      confirmed_at < now() - 12 hours.
//   2. Flip them to 'cancelled' with a clear reason. The renter
//      reliability trigger fires automatically (status='cancelled' from
//      'confirmed' = post-confirmation hit).
//   3. Email + SMS the renter with the cancellation notice.
//   4. Also notify the agency by SMS so they free up the slot.
export async function GET(req: NextRequest) {
  // Auth, only the scheduler should hit this. The secret is MANDATORY: if it
  // isn't configured, reject rather than run open (an unprotected endpoint here
  // lets anyone trigger mass cancellations + SMS/email blasts).
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader     = req.headers.get("authorization");
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const service = await createServiceClient();

  const cutoff = new Date(Date.now() - 12 * 60 * 60_000).toISOString();

  const { data: expired, error: selectError } = await service
    .from("bookings")
    .select(`
      id, renter_id, agency_id, start_date, end_date, confirmed_at, booking_fee_lkr,
      vehicles(make, model, year),
      profiles(full_name, email, phone),
      agencies(name, whatsapp_number)
    `)
    .eq("status", "confirmed")
    .gt("booking_fee_lkr", 0)   // free-launch bookings have no pay window to expire
    .is("slip_url", null)
    .lt("confirmed_at", cutoff)
    .limit(50);

  if (selectError) {
    console.error("[cron expire-bookings] select", selectError);
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const rows = (expired ?? []) as unknown as {
    id: string;
    renter_id: string;
    agency_id: string;
    start_date: string;
    end_date: string;
    confirmed_at: string;
    booking_fee_lkr: number;
    vehicles: { make: string; model: string; year: number } | null;
    profiles: { full_name: string; email: string | null; phone: string } | null;
    agencies: { name: string; whatsapp_number: string } | null;
  }[];

  let processed = 0;
  let notified  = 0;

  for (const b of rows) {
    // Atomic cancel + reason. The on_renter_cancel_reliability trigger
    // fires for free here.
    const { error: updateError } = await service
      .from("bookings")
      .update({
        status:              "cancelled",
        cancelled_at:        new Date().toISOString(),
        cancellation_reason: "Payment slip not uploaded within 12 hours of confirmation",
      })
      .eq("id", b.id)
      .eq("status", "confirmed"); // optimistic, skip if renter just paid this second

    if (updateError) {
      console.error("[cron expire-bookings] update", b.id, updateError);
      continue;
    }
    processed += 1;

    const vehicleName = b.vehicles
      ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}`
      : "your booking";
    const ref         = b.id.slice(0, 8).toUpperCase();
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk";
    const feeLabel    = formatLKR(b.booking_fee_lkr); // actual lock-in amount, not hardcoded

    // Email renter, only if a real email is on file (skip placeholder)
    const realEmail = b.profiles?.email && !b.profiles.email.endsWith("@phone.drivelink.invalid")
      ? b.profiles.email
      : null;
    if (realEmail) {
      try {
        await sendEmail({
          to:      realEmail,
          subject: `Booking ${ref} cancelled, payment window expired`,
          text:    `Hi ${b.profiles?.full_name ?? "there"},\n\nYour booking ${ref} for ${vehicleName} (${b.start_date} to ${b.end_date}) has been cancelled.\n\nWe didn't receive your ${feeLabel} lock-in payment within 12 hours of the agency confirming. No money was taken.\n\nWant to try again? Open the vehicle and request fresh dates:\n${appUrl}/vehicles\n\nThe DriveLink team`,
          html:    `<p>Hi ${b.profiles?.full_name ?? "there"},</p><p>Your booking <strong>${ref}</strong> for ${vehicleName} (${b.start_date} to ${b.end_date}) has been cancelled.</p><p>We didn't receive your <strong>${feeLabel} lock-in</strong> payment within 12 hours of the agency confirming. No money was taken.</p><p>Want to try again? <a href="${appUrl}/vehicles" style="color:#f59e0b">Browse vehicles</a>.</p><p style="color:#64748b;font-size:12px">The DriveLink team</p>`,
        });
        notified += 1;
      } catch (err) {
        console.error("[cron expire-bookings] email renter", b.id, err);
      }
    }

    // SMS renter (always)
    if (b.profiles?.phone) {
      try {
        await sendSmsIfEnabled(
          "expiry_renter",
          b.profiles.phone,
          `DriveLink: booking ${ref} cancelled, ${feeLabel} lock-in not received within 12 hours. No charge. Browse again at ${appUrl}/vehicles`
        );
      } catch (err) {
        console.error("[cron expire-bookings] sms renter", b.id, err);
      }
    }

    // SMS agency so they free up the slot
    if (b.agencies?.whatsapp_number) {
      try {
        await sendSmsIfEnabled(
          "expiry_agency",
          b.agencies.whatsapp_number,
          `DriveLink: booking ${ref} (${vehicleName}, ${b.start_date}-${b.end_date}) auto-cancelled, renter didn't pay within 12h. Slot is open again.`
        );
      } catch (err) {
        console.error("[cron expire-bookings] sms agency", b.id, err);
      }
    }
  }

  // ── Auto-complete finished rentals (backstop) ──
  // An 'active' booking past its return date + 24h grace never closes if the
  // agency forgot to "Mark complete". Flip it to 'completed' so the slot frees,
  // the renter is invited to review, and the agency is nudged to rate the renter.
  const completeCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: finished } = await service
    .from("bookings")
    .select(`
      id, renter_id, agency_id, start_date, end_date,
      vehicles(make, model, year, plate_number),
      profiles(full_name, email, phone),
      agencies(name, whatsapp_number)
    `)
    .eq("status", "active")
    .lt("end_at", completeCutoff)
    .limit(50);

  const finishedRows = (finished ?? []) as unknown as {
    id: string;
    vehicles: { make: string; model: string; year: number; plate_number: string | null } | null;
    profiles: { full_name: string; email: string | null; phone: string | null } | null;
    agencies: { name: string; whatsapp_number: string | null } | null;
  }[];

  let autoCompleted = 0;
  const completeAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk";

  for (const b of finishedRows) {
    const { error: completeError } = await service
      .from("bookings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "active"); // optimistic, skip if the agency just completed it
    if (completeError) {
      console.error("[cron auto-complete] update", b.id, completeError);
      continue;
    }
    autoCompleted += 1;

    if (!b.vehicles) continue;
    const vehicleName  = `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}`;
    const vehiclePlate = b.vehicles.plate_number ?? undefined;

    // Renter: thanks + review link.
    const realEmail = b.profiles?.email && !b.profiles.email.endsWith("@phone.drivelink.invalid")
      ? b.profiles.email
      : null;
    const renterMsg = buildRenterCompletedMessage({
      bookingId: b.id, vehicleName, vehiclePlate, agencyName: b.agencies?.name ?? "", appUrl: completeAppUrl,
    });
    try {
      await notifyCascade({
        phone:        b.profiles?.phone ?? undefined,
        smsKey:       "booking_status_renter",
        text:         renterMsg,
        email:        realEmail,
        emailSubject: `DriveLink booking ${b.id.slice(0, 8).toUpperCase()} complete`,
        emailText:    renterMsg,
      });
    } catch (err) {
      console.error("[cron auto-complete] notify renter", b.id, err);
    }

    // Agency: nudge to rate the renter.
    if (b.agencies?.whatsapp_number) {
      try {
        await notifyCascade({
          phone:  b.agencies.whatsapp_number,
          smsKey: "new_booking_agency",
          text:   buildAgencyCompletedMessage({
            bookingId: b.id, vehicleName, vehiclePlate,
            renterName: b.profiles?.full_name ?? "your renter", appUrl: completeAppUrl,
          }),
        });
      } catch (err) {
        console.error("[cron auto-complete] notify agency", b.id, err);
      }
    }
  }

  // While we're here on the daily run, sweep orphaned storage objects.
  // These accumulate when a user starts an upload but bails before the
  // profile row gets updated, or from rare edge cases in the soft-delete
  // path. Cheap to run.
  let avatarsRemoved = 0;
  let kycRemoved     = 0;
  try {
    avatarsRemoved = await sweepOrphanStorage(service, "avatars");
    kycRemoved     = await sweepOrphanStorage(service, "kyc");
  } catch (err) {
    console.error("[cron expire-bookings] storage sweep failed", err);
  }

  console.log(`[cron expire-bookings] processed=${processed} notified=${notified} auto_completed=${autoCompleted} orphans_swept=${avatarsRemoved + kycRemoved}`);
  return NextResponse.json({
    ok:         true,
    processed,
    notified,
    autoCompleted,
    avatarsRemoved,
    kycRemoved,
  });
}
