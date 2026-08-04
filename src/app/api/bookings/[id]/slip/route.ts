import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractKeyFromUrl } from "@/lib/storage/r2";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/bookings/{id}/slip   body: { slipUrl: string }
//
// The renter's payment-slip submission. bookings is fully locked (no browser
// UPDATE), so this records the slip and moves the booking confirmed ->
// payment_pending on the service client, after checking the caller owns the
// booking, it's in 'confirmed', and the slip object is one they uploaded.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ slipUrl: string }>;
  const slipUrl = typeof body.slipUrl === "string" ? body.slipUrl : null;
  if (!slipUrl || !extractKeyFromUrl(slipUrl)) {
    return NextResponse.json({ error: "A valid uploaded slip is required." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, status")
    .eq("id", id)
    .single();
  const booking = bookingRow as { id: string; renter_id: string; status: string } | null;

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.renter_id !== user.id) return NextResponse.json({ error: "Not your booking." }, { status: 403 });
  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "This booking isn't awaiting payment." }, { status: 409 });
  }

  const { error } = await service
    .from("bookings")
    .update({ slip_url: slipUrl, status: "payment_pending" })
    .eq("id", id)
    .eq("status", "confirmed");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
