import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractKeyFromUrl } from "@/lib/storage/r2";
import { notifyCascade } from "@/lib/notify";
import { runAfterResponse } from "@/lib/after-response";
import {
  FUEL_LEVELS,
  DEPOSIT_METHODS,
  MIN_INSPECTION_PHOTOS,
  INSPECTIONS_SELECT,
  type FuelLevel,
  type DepositMethod,
  type InspectionPhase,
  type InspectionChecklist,
} from "@/lib/booking/inspection-types";

// POST /api/bookings/[id]/inspections
// body: { phase, odometer_km, fuel_level, plate_confirmed, checklist?, photo_urls,
//         video_url?, notes?, deposit?: { received, method }, deposit_return?: { amount_lkr, reason? } }
//
// Page-side submission of the pickup/return condition report (migration
// 051). Service client throughout: authorisation is the explicit page-owner
// check below (mirrors the dispute route), not the booking_inspections RLS
// insert policy, so we get one validated entry point and can stamp the
// linked bookings row's photo/deposit columns in the same request.
//
// Upsert on (booking_id, phase): resubmitting before the renter has acked
// replaces the row in place (same id, same created_at). Once the renter
// has acked, the row is final, resubmission is rejected.

const PHASES = new Set<InspectionPhase>(["pickup", "return"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    phase:           string;
    odometer_km:     number;
    fuel_level:      string;
    plate_confirmed: boolean;
    checklist:       InspectionChecklist;
    photo_urls:      string[];
    video_url:       string;
    notes:           string;
    deposit:         { received: boolean; method?: string };
    deposit_return:  { amount_lkr: number; reason?: string };
  }>;

  if (!body.phase || !PHASES.has(body.phase as InspectionPhase)) {
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  }
  const phase = body.phase as InspectionPhase;

  if (!Number.isFinite(body.odometer_km) || (body.odometer_km as number) <= 0) {
    return NextResponse.json({ error: "Enter a valid odometer reading." }, { status: 400 });
  }
  const odometerKm = Math.round(body.odometer_km as number);

  if (!body.fuel_level || !FUEL_LEVELS.includes(body.fuel_level as FuelLevel)) {
    return NextResponse.json({ error: "Select the fuel level." }, { status: 400 });
  }
  const fuelLevel = body.fuel_level as FuelLevel;

  if (typeof body.plate_confirmed !== "boolean") {
    return NextResponse.json({ error: "Confirm the number plate before submitting." }, { status: 400 });
  }
  if (phase === "pickup" && body.plate_confirmed !== true) {
    return NextResponse.json(
      { error: "Confirm the number plate matches the listing before handover." },
      { status: 400 },
    );
  }

  const photoUrls = Array.isArray(body.photo_urls)
    ? body.photo_urls.filter((u): u is string => typeof u === "string" && extractKeyFromUrl(u) !== null).slice(0, 20)
    : [];
  if (photoUrls.length < MIN_INSPECTION_PHOTOS) {
    return NextResponse.json({ error: `Add at least ${MIN_INSPECTION_PHOTOS} photos before submitting.` }, { status: 400 });
  }

  const videoUrl = typeof body.video_url === "string" && extractKeyFromUrl(body.video_url) ? body.video_url : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null;

  const checklist: InspectionChecklist | null =
    body.checklist && typeof body.checklist === "object"
      ? {
          documents_present:
            typeof body.checklist.documents_present === "boolean" ? body.checklist.documents_present : undefined,
          accessories: Array.isArray(body.checklist.accessories)
            ? body.checklist.accessories.filter((a) => typeof a === "string").slice(0, 30)
            : undefined,
          notes: typeof body.checklist.notes === "string" ? body.checklist.notes.trim().slice(0, 1000) || undefined : undefined,
        }
      : null;

  // Deposit (pickup only).
  let depositReceived = false;
  let depositMethod: DepositMethod | null = null;
  if (phase === "pickup" && body.deposit && typeof body.deposit === "object") {
    depositReceived = body.deposit.received === true;
    if (depositReceived) {
      if (!body.deposit.method || !DEPOSIT_METHODS.includes(body.deposit.method as DepositMethod)) {
        return NextResponse.json({ error: "Select how the deposit was received." }, { status: 400 });
      }
      depositMethod = body.deposit.method as DepositMethod;
    }
  }

  // Deposit return (return only).
  const hasDepositReturn = phase === "return" && !!body.deposit_return && typeof body.deposit_return === "object";
  let depositReturnAmount: number | null = null;
  let depositReturnReason: string | null = null;
  if (hasDepositReturn) {
    if (!Number.isFinite(body.deposit_return!.amount_lkr) || (body.deposit_return!.amount_lkr as number) < 0) {
      return NextResponse.json({ error: "Enter a valid deposit return amount." }, { status: 400 });
    }
    depositReturnAmount = Math.round(body.deposit_return!.amount_lkr as number);
    depositReturnReason =
      typeof body.deposit_return!.reason === "string" ? body.deposit_return!.reason.trim().slice(0, 1000) || null : null;
  }

  const service = await createServiceClient();

  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, deposit_lkr, agencies(owner_id), vehicles(deposit_lkr), profiles:renter_id(phone, email)")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id:          string;
    renter_id:   string;
    agency_id:   string;
    status:      string;
    deposit_lkr: number | null;
    agencies:    { owner_id: string } | null;
    vehicles:    { deposit_lkr: number | null } | null;
    profiles:    { phone: string | null; email: string | null } | null;
  };
  const b = bookingRow as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Party check: page-owner only, this route is page-side submission only.
  if (b.agencies?.owner_id !== user.id) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }
  if (b.status !== "active") {
    return NextResponse.json({ error: "Inspections can only be recorded while the booking is active." }, { status: 409 });
  }

  if (hasDepositReturn && b.deposit_lkr != null && depositReturnAmount! < b.deposit_lkr && !depositReturnReason) {
    return NextResponse.json(
      { error: "A reason is required when returning less than the full deposit." },
      { status: 400 },
    );
  }

  // Resubmission before renter-ack replaces the row; after ack it's final.
  const { data: existingRow } = await service
    .from("booking_inspections")
    .select("id, renter_ack_at")
    .eq("booking_id", bookingId)
    .eq("phase", phase)
    .maybeSingle();
  const existing = existingRow as { id: string; renter_ack_at: string | null } | null;
  if (existing?.renter_ack_at) {
    return NextResponse.json(
      { error: "The renter already confirmed this inspection, it can't be edited." },
      { status: 409 },
    );
  }

  const { data: savedRow, error: upsertError } = await service
    .from("booking_inspections")
    .upsert(
      {
        booking_id:          bookingId,
        phase,
        submitted_by:        user.id,
        odometer_km:         odometerKm,
        fuel_level:          fuelLevel,
        plate_confirmed:     body.plate_confirmed,
        checklist,
        photo_urls:          photoUrls,
        video_url:           videoUrl,
        notes,
        renter_ack_at:       null,
        renter_dispute_note: null,
      },
      { onConflict: "booking_id,phase" },
    )
    .select(INSPECTIONS_SELECT)
    .single();

  if (upsertError) {
    console.error("[inspections] upsert", upsertError);
    return NextResponse.json({ error: "Couldn't save the inspection. Try again." }, { status: 500 });
  }

  // Mirror + deposit trail side effects on the booking row.
  const bookingUpdate: Record<string, unknown> = {
    [phase === "pickup" ? "pickup_photo_urls" : "return_photo_urls"]: photoUrls,
  };
  if (phase === "pickup" && depositReceived) {
    bookingUpdate.deposit_received_at = new Date().toISOString();
    bookingUpdate.deposit_method = depositMethod;
    if (b.deposit_lkr == null) bookingUpdate.deposit_lkr = b.vehicles?.deposit_lkr ?? 0;
  }
  if (phase === "return" && hasDepositReturn) {
    bookingUpdate.deposit_returned_at = new Date().toISOString();
    bookingUpdate.deposit_return_amount_lkr = depositReturnAmount;
    bookingUpdate.deposit_return_reason = depositReturnReason;
  }
  const { error: bookingUpdateError } = await service.from("bookings").update(bookingUpdate).eq("id", bookingId);
  if (bookingUpdateError) console.error("[inspections] booking update", bookingUpdateError);

  // Notify the renter after the response, the page shouldn't wait on it.
  runAfterResponse((async () => {
    const renter    = b.profiles;
    const realEmail = renter?.email && !renter.email.endsWith("@phone.drivelink.invalid") ? renter.email : null;
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL!;
    const link      = `${appUrl}/bookings/${bookingId}`;
    const subject   = phase === "pickup" ? "Pickup inspection ready for your review" : "Return inspection ready";
    const text       = `DriveLink: ${subject.toLowerCase()}. ${link}`;

    const notified = await notifyCascade({
      phone:        renter?.phone ?? undefined,
      smsKey:       "booking_status_renter",
      text,
      email:        realEmail,
      emailSubject: subject,
      emailText:    text,
    });
    if (!notified.delivered) console.error("[inspections] notify renter failed", bookingId, phase);
  })());

  return NextResponse.json({ ok: true, inspection: savedRow });
}
