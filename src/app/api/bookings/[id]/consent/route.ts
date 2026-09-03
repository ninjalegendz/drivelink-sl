import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { kickNotificationOutbox } from "@/lib/notification-outbox";

// POST /api/bookings/[id]/consent - renter grants document-sharing consent
// DELETE /api/bookings/[id]/consent - renter revokes it
//
// Renter-side consent for migration 051's bookings.doc_share_consent_at,
// the gate the in-app document viewer (dashboard/bookings/[id]/documents)
// checks before showing the renter's approved identity/licence photos to the
// page. Service client throughout: the bookings RLS update policies
// aren't carved out for this column, so this route is the single
// validated entry point (party check + status check).
//
// Grant is allowed while confirmed / payment_pending / active - the
// window where a page still needs to review the renter before or during
// handover. The renter may revoke throughout that same window. Once a booking
// is completed, disputed, declined or cancelled, the viewer's status check has
// already ended access and the retained consent record becomes evidence.

async function loadBooking(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  bookingId: string,
) {
  const { data } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status")
    .eq("id", bookingId)
    .single();

  return data as unknown as {
    id:         string;
    renter_id:  string;
    agency_id:  string;
    status:     string;
  } | null;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: profile } = await service
    .from("profiles")
    .select("nic_url, identity_back_url, license_front_url, license_back_url")
    .eq("id", user.id)
    .maybeSingle();
  const documents = profile as {
    nic_url: string | null;
    identity_back_url: string | null;
    license_front_url: string | null;
    license_back_url: string | null;
  } | null;
  if (!documents || ![documents.nic_url, documents.identity_back_url, documents.license_front_url, documents.license_back_url].some(Boolean)) {
    return NextResponse.json(
      { error: "Your approved document copy is still being prepared. Wait a moment and try again, or contact DriveLink support if this continues." },
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

  kickNotificationOutbox(service);

  return NextResponse.json({ ok: true, doc_share_consent_at: now });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const b = await loadBooking(service, bookingId);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (b.renter_id !== user.id) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  // Decision 12: the renter can withdraw document access any time before the
  // evidence-retention point - i.e. while the booking is still confirmed,
  // awaiting payment, or active (in progress). Once it's completed / disputed /
  // cancelled the shared record is retained and revocation is closed.
  if (!["confirmed", "payment_pending", "active"].includes(b.status)) {
    return NextResponse.json(
      { error: "Document sharing can no longer be withdrawn for this booking." },
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
