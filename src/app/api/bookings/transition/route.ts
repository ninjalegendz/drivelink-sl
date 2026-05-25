import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms/textlk";
import {
  buildRenterConfirmedMessage,
  buildRenterDeclinedMessage,
} from "@/lib/sms/messages";

// POST /api/bookings/transition
// body: { bookingId: string, to: "confirmed" | "declined" | "completed" }
//
// Agency-owner endpoint. Replaces the previous client-side direct
// supabase update from AgencyBookingActions so that the renter actually
// gets notified by SMS on confirm / decline — that was silently missing
// when transitions were done client-side.
//
// The Postgres-side "Agency can transition booking" RLS policy is the
// authoritative gate. We don't double-check ownership here: we just
// attempt the update with the caller's cookie-bound client and let RLS
// reject it if they're not the agency owner. On success we read the
// (now-updated) booking back via the service client to get the joined
// renter/vehicle/agency data needed for the SMS, then fire-and-forget
// the SMS. SMS failure is logged but does not fail the transition —
// the realtime renter page already updates from the WAL stream.

const ALLOWED = new Set(["confirmed", "declined", "completed"] as const);
type AllowedStatus = typeof ALLOWED extends Set<infer T> ? T : never;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    bookingId: string;
    to:        string;
  }>;
  if (!body.bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  if (!body.to || !ALLOWED.has(body.to as AllowedStatus)) {
    return NextResponse.json({ error: "Invalid transition target" }, { status: 400 });
  }
  const to = body.to as AllowedStatus;

  const now    = new Date().toISOString();
  const update: Record<string, unknown> = { status: to };
  if (to === "confirmed") update.confirmed_at = now;
  if (to === "declined")  update.declined_at  = now;
  if (to === "completed") update.completed_at = now;

  // Use the caller's cookie-bound client so RLS enforces ownership.
  // Postgres exclusion violation (23P01) bubbles up if the dates clash.
  const { error: updateError } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", body.bookingId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message, code: updateError.code },
      { status: updateError.code === "23P01" ? 409 : 400 },
    );
  }

  // Fire renter SMS for confirm/decline. Completed doesn't need one —
  // the renter just used the car. Service client bypasses RLS for the
  // join read.
  if (to === "confirmed" || to === "declined") {
    const service = await createServiceClient();
    const { data: full } = await service
      .from("bookings")
      .select("id, renter_id, vehicles(make, model, year), agencies(name)")
      .eq("id", body.bookingId)
      .single();

    type Joined = {
      id:        string;
      renter_id: string;
      vehicles:  { make: string; model: string; year: number } | null;
      agencies:  { name: string } | null;
    };
    const row = full as Joined | null;

    if (row?.renter_id && row.vehicles && row.agencies) {
      const { data: renter } = await service
        .from("profiles")
        .select("phone")
        .eq("id", row.renter_id)
        .single();
      const renterPhone = (renter as { phone?: string } | null)?.phone;

      if (renterPhone) {
        const vehicleName = `${row.vehicles.year} ${row.vehicles.make} ${row.vehicles.model}`;
        const appUrl      = process.env.NEXT_PUBLIC_APP_URL!;
        const message = to === "confirmed"
          ? buildRenterConfirmedMessage({ bookingId: row.id, vehicleName, agencyName: row.agencies.name, appUrl })
          : buildRenterDeclinedMessage({  bookingId: row.id, vehicleName, agencyName: row.agencies.name, appUrl });

        const smsResult = await sendSms(renterPhone, message);
        if (!smsResult.ok) {
          console.error("[booking transition] renter SMS failed", row.id, smsResult.error);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, newStatus: to });
}
