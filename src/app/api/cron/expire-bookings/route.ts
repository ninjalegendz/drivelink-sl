import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { sendSms } from "@/lib/sms/textlk";
import { sweepOrphanStorage } from "@/lib/storage/sweep";

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
  // Auth — only Vercel Cron should hit this
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader     = req.headers.get("authorization");
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const service = await createServiceClient();

  const cutoff = new Date(Date.now() - 12 * 60 * 60_000).toISOString();

  const { data: expired, error: selectError } = await service
    .from("bookings")
    .select(`
      id, renter_id, agency_id, start_date, end_date, confirmed_at,
      vehicles(make, model, year),
      profiles(full_name, email, phone),
      agencies(name, whatsapp_number)
    `)
    .eq("status", "confirmed")
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
      .eq("status", "confirmed"); // optimistic — skip if renter just paid this second

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

    // Email renter — only if a real email is on file (skip placeholder)
    const realEmail = b.profiles?.email && !b.profiles.email.endsWith("@phone.drivelink.invalid")
      ? b.profiles.email
      : null;
    if (realEmail) {
      try {
        await sendEmail({
          to:      realEmail,
          subject: `Booking ${ref} cancelled — payment window expired`,
          text:    `Hi ${b.profiles?.full_name ?? "there"},\n\nYour booking ${ref} for ${vehicleName} (${b.start_date} to ${b.end_date}) has been cancelled.\n\nWe didn't receive your Rs. 500 lock-in payment within 12 hours of the agency confirming. No money was taken.\n\nWant to try again? Open the vehicle and request fresh dates:\n${appUrl}/vehicles\n\n— DriveLink`,
          html:    `<p>Hi ${b.profiles?.full_name ?? "there"},</p><p>Your booking <strong>${ref}</strong> for ${vehicleName} (${b.start_date} to ${b.end_date}) has been cancelled.</p><p>We didn't receive your <strong>Rs. 500 lock-in</strong> payment within 12 hours of the agency confirming. No money was taken.</p><p>Want to try again? <a href="${appUrl}/vehicles" style="color:#f59e0b">Browse vehicles</a>.</p><p style="color:#64748b;font-size:12px">— DriveLink</p>`,
        });
        notified += 1;
      } catch (err) {
        console.error("[cron expire-bookings] email renter", b.id, err);
      }
    }

    // SMS renter (always)
    if (b.profiles?.phone) {
      try {
        await sendSms(
          b.profiles.phone,
          `DriveLink: booking ${ref} cancelled — Rs. 500 lock-in not received within 12 hours. No charge. Browse again at ${appUrl}/vehicles`
        );
      } catch (err) {
        console.error("[cron expire-bookings] sms renter", b.id, err);
      }
    }

    // SMS agency so they free up the slot
    if (b.agencies?.whatsapp_number) {
      try {
        await sendSms(
          b.agencies.whatsapp_number,
          `DriveLink: booking ${ref} (${vehicleName}, ${b.start_date}-${b.end_date}) auto-cancelled — renter didn't pay within 12h. Slot is open again.`
        );
      } catch (err) {
        console.error("[cron expire-bookings] sms agency", b.id, err);
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

  console.log(`[cron expire-bookings] processed=${processed} notified=${notified} orphans_swept=${avatarsRemoved + kycRemoved}`);
  return NextResponse.json({
    ok:         true,
    processed,
    notified,
    avatarsRemoved,
    kycRemoved,
  });
}
