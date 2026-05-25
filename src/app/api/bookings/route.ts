import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms/textlk";
import { buildAgencyPingMessage } from "@/lib/sms/messages";
import { calcBookingPrice } from "@/lib/bookings/pricing";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/send";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Renter must have completed KYC. Mirrors the RLS guard so the client
  // gets a clean error code it can branch on instead of a generic 500
  // from PostgREST.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .single();
  const callerKyc = (callerProfile as { kyc_status?: string } | null)?.kyc_status;
  if (callerKyc !== "verified") {
    return NextResponse.json({
      error: "Verify your identity before booking.",
      code:  "kyc_required",
    }, { status: 403 });
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
    service
      .from("agencies")
      .select("id, name, whatsapp_number, sms_notifications_enabled, whatsapp_notifications_enabled")
      .eq("id", agency_id)
      .single(),
    service.from("vehicles").select("make, model, year, daily_rate_lkr, monthly_rate_lkr").eq("id", vehicle_id).single(),
    service.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!agency || !vehicle) {
    return NextResponse.json({ error: "Vehicle or agency not found" }, { status: 404 });
  }

  const a = agency as {
    id:                              string;
    name:                            string;
    whatsapp_number:                 string;
    sms_notifications_enabled:       boolean;
    whatsapp_notifications_enabled:  boolean;
  };
  const v = vehicle as { make: string; model: string; year: number; daily_rate_lkr: number; monthly_rate_lkr: number | null };

  // Reject if the dates clash with any in-flight booking (incl. pending
  // requests) OR an agency-set maintenance block. The slot only frees
  // when the existing booking moves to declined/cancelled.
  // Overlap rule: existing.start < new.end AND existing.end > new.start
  const [{ data: bookingConflicts }, { data: blockConflicts }] = await Promise.all([
    service
      .from("bookings")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .in("status", ["requested", "pending_confirmation", "confirmed", "payment_pending", "active", "disputed"])
      .lt("start_date", end_date)
      .gt("end_date", start_date)
      .limit(1),
    service
      .from("vehicle_blocks")
      .select("id")
      .eq("vehicle_id", vehicle_id)
      .lt("start_date", end_date)
      .gt("end_date", start_date)
      .limit(1),
  ]);

  if (bookingConflicts && bookingConflicts.length > 0) {
    return NextResponse.json(
      { error: "These dates are already booked. Try different dates." },
      { status: 409 }
    );
  }
  if (blockConflicts && blockConflicts.length > 0) {
    return NextResponse.json(
      { error: "The agency has marked these dates as unavailable. Try different dates." },
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Fire SMS + WhatsApp in parallel based on the agency's per-channel
  // preferences. Both non-blocking — don't fail the booking if either
  // notification path fails. The dashboard realtime toast is the third
  // channel and fires regardless of these flags.
  const smsPromise = a.sms_notifications_enabled
    ? sendSms(
        a.whatsapp_number,
        buildAgencyPingMessage({
          bookingId:  booking.id,
          renterName,
          vehicleName,
          startDate:  start_date,
          endDate:    end_date,
          totalDays:  days,
          appUrl,
        }),
      )
    : Promise.resolve({ ok: true, skipped: true } as const);

  // Template body has 5 variables (vars can't be at the start/end and
  // Meta enforces a max-density ratio). The dashboard URL is a static
  // CTA button on the template — not a body variable.
  const waPromise = a.whatsapp_notifications_enabled
    ? sendWhatsAppTemplate({
        to:           a.whatsapp_number,
        templateName: "new_booking_request",
        languageCode: "en",
        bodyParams: [
          a.name,                            // {{1}} — who we're addressing
          renterName,                        // {{2}} — renter requesting
          vehicleName,                       // {{3}} — vehicle
          `${start_date} → ${end_date}`,     // {{4}} — date range, single var
          String(days),                      // {{5}} — duration
        ],
      })
    : Promise.resolve({ ok: true, skipped: true } as const);

  const [smsResult, waResult] = await Promise.all([smsPromise, waPromise]);

  if (!smsResult.ok) console.error("[booking notify] SMS failed", booking.id, smsResult.error);
  if (!waResult.ok)  console.error("[booking notify] WhatsApp failed", booking.id, waResult.error);

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
