import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";

// POST /api/bookings/[id]/consent   — renter grants document-sharing consent
// DELETE /api/bookings/[id]/consent — renter revokes it
//
// Renter-side consent for migration 051's bookings.doc_share_consent_at,
// the gate the in-app document viewer (dashboard/bookings/[id]/documents)
// checks before showing the renter's NIC/selfie/licence photos to the
// page. Service client throughout: the bookings RLS update policies
// aren't carved out for this column, so this route is the single
// validated entry point (party check + status check), same idiom as the
// dispute and inspections routes.
//
// Grant is allowed while confirmed / payment_pending / active — the
// window where a page still needs to review the renter before or during
// handover. Revoke is narrower: only while active. Once a booking is
// completed, the document viewer's own status check already cuts off
// access regardless of this stamp, so there's nothing meaningful left to
// revoke, and pre-active statuses haven't had anything viewed yet either.

async function loadBooking(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  bookingId: string,
) {
  const { data } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, agencies(name, owner_id)")
    .eq("id", bookingId)
    .single();

  return data as unknown as {
    id:         string;
    renter_id:  string;
    agency_id:  string;
    status:     string;
    agencies:   { name: string; owner_id: string } | null;
  } | null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const b = await loadBooking(service, bookingId);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (b.renter_id !== user.id) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  if (!["confirmed", "payment_pending", "active"].includes(b.status)) {
    return NextResponse.json(
      { error: "Documents can only be shared once your booking is confirmed." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await service
    .from("bookings")
    .update({ doc_share_consent_at: now })
    .eq("id", bookingId);

  if (error) {
    console.error("[consent] grant", error);
    return NextResponse.json({ error: "Couldn't share your documents. Try again." }, { status: 500 });
  }

  // Tell the page owner their renter just unlocked document access. Fire
  // after the response, same pattern as the dispute/inspections routes.
  runAfterResponse((async () => {
    const ownerId = b.agencies?.owner_id;
    if (!ownerId) return;

    const { data: ownerRow } = await service.from("profiles").select("phone, email").eq("id", ownerId).single();
    const owner = ownerRow as { phone: string | null; email: string | null } | null;
    const realEmail = owner?.email && !owner.email.endsWith("@phone.drivelink.invalid") ? owner.email : null;

    const ref    = b.id.slice(0, 8).toUpperCase();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const text   = `DriveLink: the renter shared their documents for booking ${ref}. Review them: ${appUrl}/dashboard/bookings/${b.id}/documents`;

    const notified = await notifyCascade({
      phone:        owner?.phone ?? undefined,
      smsKey:       "new_booking_agency",
      text,
      email:        realEmail,
      emailSubject: `Renter shared documents for booking ${ref}`,
      emailText:    text,
    });
    if (!notified.delivered) console.error("[consent] notify owner failed", b.id);
  })());

  return NextResponse.json({ ok: true, doc_share_consent_at: now });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const b = await loadBooking(service, bookingId);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (b.renter_id !== user.id) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  if (b.status !== "active") {
    return NextResponse.json(
      { error: "Sharing can only be revoked while the booking is active." },
      { status: 409 },
    );
  }

  const { error } = await service
    .from("bookings")
    .update({ doc_share_consent_at: null })
    .eq("id", bookingId);

  if (error) {
    console.error("[consent] revoke", error);
    return NextResponse.json({ error: "Couldn't update sharing. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
