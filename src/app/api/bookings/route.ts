import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms/textlk";
import { buildAgencyPingMessage } from "@/lib/sms/messages";
import { calcBookingPrice } from "@/lib/bookings/pricing";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const { vehicle_id, agency_id, start_date, end_date } = body;

  if (!vehicle_id || !agency_id || !start_date || !end_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Use service client for insert so RLS doesn't block server-side ops
  const service = await createServiceClient();

  // Fetch the vehicle's canonical rates server-side — never trust client-supplied prices.
  const [{ data: agency }, { data: vehicle }, { data: renter }] = await Promise.all([
    service.from("agencies").select("id, name, whatsapp_number").eq("id", agency_id).single(),
    service.from("vehicles").select("make, model, year, daily_rate_lkr, monthly_rate_lkr").eq("id", vehicle_id).single(),
    service.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!agency || !vehicle) {
    return NextResponse.json({ error: "Vehicle or agency not found" }, { status: 404 });
  }

  const v = vehicle as { make: string; model: string; year: number; daily_rate_lkr: number; monthly_rate_lkr: number | null };

  // Reject if the dates clash with an already-confirmed/active booking on the
  // same vehicle. Pending requests are allowed to stack — agency picks one.
  // Overlap rule: existing.start < new.end AND existing.end > new.start
  const { data: conflicts } = await service
    .from("bookings")
    .select("id")
    .eq("vehicle_id", vehicle_id)
    .in("status", ["confirmed", "payment_pending", "active"])
    .lt("start_date", end_date)
    .gt("end_date", start_date)
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "These dates are already booked. Try different dates." },
      { status: 409 }
    );
  }

  // Calendar-aware subtotal (uses real month boundaries, not 30-day blocks)
  const { subtotal } = calcBookingPrice({
    startDate:      start_date,
    endDate:        end_date,
    dailyRateLkr:   v.daily_rate_lkr,
    monthlyRateLkr: v.monthly_rate_lkr,
  });
  const days = Math.ceil(
    (new Date(end_date).getTime() - new Date(start_date).getTime()) / 86400000
  );

  // Create the booking
  const { data: booking, error: insertError } = await service
    .from("bookings")
    .insert({
      vehicle_id,
      agency_id,
      renter_id: user.id,
      status: "pending_confirmation",
      start_date,
      end_date,
      daily_rate_lkr:  v.daily_rate_lkr,
      subtotal_lkr:    subtotal,
      booking_fee_lkr: 500,
    })
    .select("id")
    .single();

  if (insertError || !booking) {
    console.error("[booking create]", insertError);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  // Fire SMS ping to agency (non-blocking — don't fail the booking if SMS fails).
  // Sent via text.lk; the agency confirms by clicking through to the dashboard.
  const vehicleName = `${v.year} ${v.make} ${v.model}`;
  const renterName  = renter?.full_name ?? "Verified Renter";

  const result = await sendSms(
    agency.whatsapp_number,
    buildAgencyPingMessage({
      bookingId:  booking.id,
      renterName,
      vehicleName,
      startDate:  start_date,
      endDate:    end_date,
      totalDays:  days,
      appUrl:     process.env.NEXT_PUBLIC_APP_URL!,
    })
  );
  if (!result.ok) {
    console.error("[booking notify] SMS failed", booking.id, result.error);
  }

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
