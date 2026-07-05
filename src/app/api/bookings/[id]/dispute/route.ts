import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import { raiseDispute } from "@/lib/booking/raise-dispute";

// POST /api/bookings/[id]/dispute
// body: { reason: string, type?: incident_type, amount_lkr?: number, photo_urls?: string[] }
//
// Either party raises a problem: mid-rental (status 'active'), or within
// 72h of completion (post-return damage/fine claims). Creates an
// `incidents` row and moves the booking to 'disputed' for admin
// resolution.
//
// Goes through the service client deliberately: the bookings RLS update
// policies don't include 'disputed' as a reachable target for either
// party, and we keep it that way — this route is the single, validated
// entry point (party check, status check, claim window, reason required).

const CLAIM_WINDOW_MS = 72 * 60 * 60 * 1000;

const DISPUTE_TYPES = new Set([
  "accident", "breakdown", "late_return", "no_show", "damage_claim", "fine_received",
  "toll_claim", "lost_item", "driver_complaint", "conduct_violation",
  "vehicle_mismatch", "deposit_violation", "other",
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    reason:     string;
    type:       string;
    amount_lkr: number;
    photo_urls: string[];
  }>;

  const reason = body.reason?.trim() ?? "";
  if (reason.length < 10 || reason.length > 2000) {
    return NextResponse.json(
      { error: "Describe the problem in at least 10 characters (max 2000)." },
      { status: 400 },
    );
  }
  const type = body.type && DISPUTE_TYPES.has(body.type) ? body.type : "other";
  const amount = Number.isFinite(body.amount_lkr) && (body.amount_lkr as number) > 0
    ? Math.round(body.amount_lkr as number)
    : null;
  const photos = Array.isArray(body.photo_urls)
    ? body.photo_urls.filter((u) => typeof u === "string").slice(0, 12)
    : [];

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, completed_at, agencies(owner_id, name), vehicles(make, model, year), profiles:renter_id(phone, email, full_name)")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id: string; renter_id: string; agency_id: string; status: string; completed_at: string | null;
    agencies: { owner_id: string; name: string } | null;
    vehicles: { make: string; model: string; year: number } | null;
    profiles: { phone: string | null; email: string | null; full_name: string } | null;
  };
  const b = bookingRow as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Party check: renter, or owner of the page the booking belongs to.
  const isRenter = b.renter_id === user.id;
  const isOwner  = b.agencies?.owner_id === user.id;
  if (!isRenter && !isOwner) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }

  // Status/window check.
  if (b.status === "completed") {
    const completedAt = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    if (Date.now() - completedAt > CLAIM_WINDOW_MS) {
      return NextResponse.json(
        { error: "The 72-hour post-return claim window has closed. Contact support if this is urgent." },
        { status: 400 },
      );
    }
  } else if (b.status !== "active") {
    return NextResponse.json(
      { error: "Problems can be reported while a rental is active, or within 72 hours of completion." },
      { status: 400 },
    );
  }

  const result = await raiseDispute({
    service,
    bookingId:   b.id,
    filedBy:     user.id,
    filedBySide: isRenter ? "renter" : "page",
    type,
    reason,
    amountLkr:   amount,
    photoUrls:   photos,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Couldn't open the dispute." }, { status: 500 });
  }

  // Tell the other side (and leave admin to the realtime inbox). Fire after
  // the response, same pattern as the transition route.
  runAfterResponse((async () => {
    const ref     = b.id.slice(0, 8).toUpperCase();
    const vehicle = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "your booking";
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL!;

    if (isRenter) {
      // Notify the page owner.
      const { data: ownerRow } = await service
        .from("profiles")
        .select("phone, email")
        .eq("id", b.agencies!.owner_id)
        .single();
      const owner = ownerRow as { phone: string | null; email: string | null } | null;
      const realEmail = owner?.email && !owner.email.endsWith("@phone.drivelink.invalid") ? owner.email : null;
      await notifyCascade({
        phone:        owner?.phone ?? undefined,
        smsKey:       "new_booking_agency",
        text:         `DriveLink: a problem was reported on booking ${ref} (${vehicle}). Review it: ${appUrl}/dashboard/bookings`,
        email:        realEmail,
        emailSubject: `Problem reported on booking ${ref}`,
        emailText:    `A problem was reported on booking ${ref} (${vehicle}). Reason: ${reason}\n\nReview: ${appUrl}/dashboard/bookings`,
      });
    } else {
      // Notify the renter.
      const realEmail = b.profiles?.email && !b.profiles.email.endsWith("@phone.drivelink.invalid") ? b.profiles.email : null;
      await notifyCascade({
        phone:        b.profiles?.phone ?? undefined,
        smsKey:       "booking_status_renter",
        text:         `DriveLink: a problem was reported on booking ${ref} (${vehicle}). Our team will review it. Details: ${appUrl}/bookings/${b.id}`,
        email:        realEmail,
        emailSubject: `Problem reported on booking ${ref}`,
        emailText:    `A problem was reported on your booking ${ref} (${vehicle}). Reason: ${reason}\n\nOur team will review it and follow up: ${appUrl}/bookings/${b.id}`,
      });
    }
  })());

  return NextResponse.json({ ok: true, newStatus: "disputed" });
}
