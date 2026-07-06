import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import { raiseDispute } from "@/lib/booking/raise-dispute";
import { type InspectionPhase } from "@/lib/booking/inspection-types";

// POST /api/bookings/[id]/inspections/ack
// body: { phase, action: "accept" | "dispute", note?, deposit_ack? }
//
// The renter's response to a page-submitted pickup/return inspection.
// "accept" stamps renter_ack_at (plus the matching deposit-ack timestamp on
// bookings when deposit_ack is set). "dispute" leaves renter_ack_at null,
// records the renter's note, and opens a dispute through the shared
// raiseDispute() helper, exactly the same core write /api/bookings/[id]/dispute
// uses, which pauses the booking for admin review.

const PHASES = new Set<InspectionPhase>(["pickup", "return"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    phase:       string;
    action:      string;
    note:        string;
    deposit_ack: boolean;
  }>;

  if (!body.phase || !PHASES.has(body.phase as InspectionPhase)) {
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  }
  const phase = body.phase as InspectionPhase;

  if (body.action !== "accept" && body.action !== "dispute") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const note = (body.note ?? "").trim().slice(0, 2000);
  if (body.action === "dispute" && note.length < 10) {
    return NextResponse.json({ error: "Describe the difference in at least 10 characters." }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, status, agencies(owner_id), vehicles(make, model, year)")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id:        string;
    renter_id: string;
    status:    string;
    agencies:  { owner_id: string } | null;
    vehicles:  { make: string; model: string; year: number } | null;
  };
  const b = bookingRow as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Party check: renter on the booking only.
  if (b.renter_id !== user.id) return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  if (b.status !== "active") return NextResponse.json({ error: "This booking isn't active." }, { status: 409 });

  const { data: inspectionRow } = await service
    .from("booking_inspections")
    .select("id, renter_ack_at")
    .eq("booking_id", bookingId)
    .eq("phase", phase)
    .maybeSingle();
  const inspection = inspectionRow as { id: string; renter_ack_at: string | null } | null;
  if (!inspection) return NextResponse.json({ error: "No inspection to review yet." }, { status: 404 });
  if (inspection.renter_ack_at) {
    return NextResponse.json({ error: "You've already responded to this inspection." }, { status: 409 });
  }

  const ref     = b.id.slice(0, 8).toUpperCase();
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL!;

  async function notifyOwner(text: string, emailSubject: string, emailText: string) {
    const { data: ownerRow } = await service.from("profiles").select("phone, email").eq("id", b!.agencies!.owner_id).single();
    const owner     = ownerRow as { phone: string | null; email: string | null } | null;
    const realEmail = owner?.email && !owner.email.endsWith("@phone.drivelink.invalid") ? owner.email : null;
    await notifyCascade({
      phone:        owner?.phone ?? undefined,
      smsKey:       "new_booking_agency",
      text,
      email:        realEmail,
      emailSubject,
      emailText,
    });
  }

  if (body.action === "accept") {
    const { error: ackError } = await service
      .from("booking_inspections")
      .update({ renter_ack_at: new Date().toISOString() })
      .eq("id", inspection.id);
    if (ackError) {
      console.error("[inspections ack] accept", ackError);
      return NextResponse.json({ error: "Couldn't save your response. Try again." }, { status: 500 });
    }

    if (body.deposit_ack) {
      const depositColumn = phase === "pickup" ? "deposit_received_ack_at" : "deposit_return_ack_at";
      const { error: depositError } = await service
        .from("bookings")
        .update({ [depositColumn]: new Date().toISOString() })
        .eq("id", bookingId);
      if (depositError) console.error("[inspections ack] deposit ack", depositError);
    }

    runAfterResponse((async () => {
      const text = phase === "pickup"
        ? `DriveLink: renter confirmed the pickup inspection on booking ${ref}, rental is underway.`
        : `DriveLink: renter confirmed the return inspection on booking ${ref}.`;
      await notifyOwner(text, `Inspection confirmed on booking ${ref}`, text);
    })());

    return NextResponse.json({ ok: true });
  }

  // action === "dispute"
  const { error: noteError } = await service
    .from("booking_inspections")
    .update({ renter_dispute_note: note })
    .eq("id", inspection.id);
  if (noteError) {
    console.error("[inspections ack] dispute note", noteError);
    return NextResponse.json({ error: "Couldn't save your response. Try again." }, { status: 500 });
  }

  const result = await raiseDispute({
    service,
    bookingId,
    filedBy:     user.id,
    filedBySide: "renter",
    type:        phase === "pickup" ? "vehicle_mismatch" : "damage_claim",
    reason:      note,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Couldn't open the dispute." }, { status: 500 });
  }

  runAfterResponse((async () => {
    const vehicle = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "your booking";
    const text    = `DriveLink: a problem was reported on the ${phase} inspection for booking ${ref} (${vehicle}). Review it: ${appUrl}/dashboard/bookings`;
    await notifyOwner(text, `Problem reported on booking ${ref}`, `${text}\n\nReason: ${note}`);
  })());

  return NextResponse.json({ ok: true, newStatus: "disputed" });
}
