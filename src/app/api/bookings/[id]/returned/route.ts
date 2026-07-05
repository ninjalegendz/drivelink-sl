import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST /api/bookings/[id]/returned
//
// The renter's half of the return handshake: they report handing the car back.
// Sets renter_returned_at; the agency then confirms receipt and completes the
// booking. Idempotent, re-posting once it's set is a no-op. Authorised here
// (renter owns the booking, booking is active) rather than via a widened RLS
// update policy, mirroring the handover-photos route.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: booking } = await service
    .from("bookings")
    .select("id, renter_id, status, renter_returned_at")
    .eq("id", id)
    .single();
  const b = booking as { id: string; renter_id: string; status: string; renter_returned_at: string | null } | null;

  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (b.renter_id !== user.id) return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  if (b.status !== "active") return NextResponse.json({ error: "This booking isn't active." }, { status: 409 });

  if (!b.renter_returned_at) {
    const { error } = await service
      .from("bookings")
      .update({ renter_returned_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
