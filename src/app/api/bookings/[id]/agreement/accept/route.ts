import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import type { AcceptMeta } from "@/lib/booking/agreement";

// POST /api/bookings/[id]/agreement/accept
// body: {} — the caller's session decides which side is accepting.
//
// Stamps the digital rental agreement (migration 051) for the caller's side:
// renter_accepted_at/_meta when the renter accepts, owner_accepted_at/_meta
// when the Rental Page owner accepts. Service client throughout, the
// authorisation is the explicit party check below (mirrors the dispute
// route) — booking_agreements has no client-side write policies on purpose,
// acceptance needs server-side timestamping + meta capture.
//
// 409 if the caller's side already accepted (accepting is one-shot; the
// stamp is the signature). When THIS call completes the pair, both parties
// are notified that the agreement is fully signed.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();

  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, agencies(owner_id, name), profiles:renter_id(full_name, phone, email)")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id:        string;
    renter_id: string;
    agency_id: string;
    agencies:  { owner_id: string; name: string } | null;
    profiles:  { full_name: string; phone: string | null; email: string | null } | null;
  };
  const b = bookingRow as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Party check: renter, or owner of the Rental Page the booking belongs to.
  const isRenter = b.renter_id === user.id;
  const isOwner  = b.agencies?.owner_id === user.id;
  if (!isRenter && !isOwner) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }

  const { data: agreementRow } = await service
    .from("booking_agreements")
    .select("id, renter_accepted_at, owner_accepted_at")
    .eq("booking_id", bookingId)
    .maybeSingle();
  const agreement = agreementRow as {
    id:                 string;
    renter_accepted_at: string | null;
    owner_accepted_at:  string | null;
  } | null;
  if (!agreement) {
    return NextResponse.json(
      { error: "The rental agreement for this booking hasn't been generated yet." },
      { status: 404 },
    );
  }

  const alreadyAccepted = isRenter ? agreement.renter_accepted_at : agreement.owner_accepted_at;
  if (alreadyAccepted) {
    return NextResponse.json({ error: "You've already accepted this agreement." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const meta: AcceptMeta = { ua: req.headers.get("user-agent") ?? "", ts: now };
  const update = isRenter
    ? { renter_accepted_at: now, renter_accept_meta: meta }
    : { owner_accepted_at: now, owner_accept_meta: meta };

  // Guard the stamped column with `.is(..., null)` so two racing accepts
  // from the same side can't both land, the loser simply matches 0 rows.
  const { data: updatedRows, error: updateError } = await service
    .from("booking_agreements")
    .update(update)
    .eq("id", agreement.id)
    .is(isRenter ? "renter_accepted_at" : "owner_accepted_at", null)
    .select("id");
  if (updateError) {
    console.error("[agreement accept]", updateError);
    return NextResponse.json({ error: "Couldn't record your acceptance. Try again." }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: "You've already accepted this agreement." }, { status: 409 });
  }

  // Did this acceptance complete the pair?
  const bothAccepted = isRenter ? !!agreement.owner_accepted_at : !!agreement.renter_accepted_at;

  if (bothAccepted) {
    runAfterResponse((async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
      const ref    = b.id.slice(0, 8).toUpperCase();
      const text   =
        `DriveLink: rental agreement for booking ${ref} signed by both parties — view it any time from the booking.`;

      // Renter side.
      const renter          = b.profiles;
      const renterRealEmail = renter?.email && !renter.email.endsWith("@phone.drivelink.invalid") ? renter.email : null;
      await notifyCascade({
        phone:        renter?.phone ?? undefined,
        smsKey:       "booking_status_renter",
        text:         `${text} ${appUrl}/bookings/${b.id}/agreement`,
        email:        renterRealEmail,
        emailSubject: `Rental agreement signed — booking ${ref}`,
        emailText:    `${text}\n\n${appUrl}/bookings/${b.id}/agreement`,
      });

      // Page-owner side.
      const { data: ownerRow } = await service
        .from("profiles")
        .select("phone, email")
        .eq("id", b.agencies!.owner_id)
        .single();
      const owner          = ownerRow as { phone: string | null; email: string | null } | null;
      const ownerRealEmail = owner?.email && !owner.email.endsWith("@phone.drivelink.invalid") ? owner.email : null;
      await notifyCascade({
        phone:        owner?.phone ?? undefined,
        smsKey:       "new_booking_agency",
        text:         `${text} ${appUrl}/bookings/${b.id}/agreement`,
        email:        ownerRealEmail,
        emailSubject: `Rental agreement signed — booking ${ref}`,
        emailText:    `${text}\n\n${appUrl}/bookings/${b.id}/agreement`,
      });
    })());
  }

  return NextResponse.json({ ok: true, bothAccepted });
}
