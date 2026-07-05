import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOwnedPages } from "@/lib/pages/active-page";
import { extractKeyFromUrl } from "@/lib/storage/r2";

// POST /api/bookings/[id]/photos
// body: { stage: "pickup" | "return", urls: string[] }
//
// Records handover condition photos (plan §7/§14/§18). Either the renter or
// the booking's agency owner may upload. We validate the caller owns the
// booking, then write the photo array via the service client (the photo
// columns aren't covered by a narrow renter/agency RLS update policy, so we
// authorise here explicitly instead of widening RLS).

const STAGES = new Set(["pickup", "return"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ stage: string; urls: string[] }>;
  if (!body.stage || !STAGES.has(body.stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  // Only accept URLs that point at our own R2 bucket, never store arbitrary
  // client-supplied URLs (could be external/malicious and we render them).
  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string" && extractKeyFromUrl(u) !== null).slice(0, 12)
    : [];

  const service = await createServiceClient();

  const { data: booking } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status")
    .eq("id", id)
    .single();
  const b = booking as { id: string; renter_id: string; agency_id: string; status: string } | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Authorise: renter on the booking, or owner of one of this account's own
  // Rental Pages (an account can own up to 5, so check the whole owned set,
  // not just a single agency).
  let allowed = b.renter_id === user.id;
  if (!allowed) {
    const ownedPages = await getOwnedPages(service, user.id);
    allowed = ownedPages.some((p) => p.id === b.agency_id);
  }
  if (!allowed) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  // Only meaningful once a booking is live (confirmed → completed).
  if (!["confirmed", "active", "completed"].includes(b.status)) {
    return NextResponse.json({ error: "Booking is not active yet" }, { status: 409 });
  }

  const column = body.stage === "pickup" ? "pickup_photo_urls" : "return_photo_urls";
  const { error: updateError } = await service
    .from("bookings")
    .update({ [column]: urls })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, stage: body.stage, count: urls.length });
}
