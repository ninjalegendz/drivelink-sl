import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp/send";

// ─── GET: Meta webhook verification handshake ─────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log("[WhatsApp webhook] Verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: Incoming messages from WhatsApp ────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: WhatsAppWebhookPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Meta sends test pings with no messages — acknowledge immediately
  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (!messages?.length) continue;

      for (const message of messages) {
        if (message.type !== "text") continue;

        const reply    = message.text?.body?.trim().toUpperCase() ?? "";
        const fromPhone = message.from;

        await handleAgencyReply({ fromPhone, reply });
      }
    }
  }

  // Always return 200 — Meta will retry if we return anything else
  return NextResponse.json({ status: "ok" });
}

// ─── Core reply handler ───────────────────────────────────────────────────────

async function handleAgencyReply({
  fromPhone,
  reply,
}: {
  fromPhone: string;
  reply: string;
}) {
  if (reply !== "YES" && reply !== "NO") {
    // Not a booking reply — ignore
    return;
  }

  const supabase = await createServiceClient();

  // Find the agency by their WhatsApp number
  // Normalise: strip leading + and spaces for comparison
  const normalisedPhone = fromPhone.replace(/\D/g, "");

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, whatsapp_number")
    .ilike("whatsapp_number", `%${normalisedPhone.slice(-9)}%`) // match last 9 digits
    .single();

  if (!agency) {
    console.warn("[WhatsApp webhook] Unknown sender:", fromPhone);
    return;
  }

  // Find the oldest pending booking for this agency
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, renter_id, vehicle_id")
    .eq("agency_id", agency.id)
    .eq("status", "pending_confirmation")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!booking) {
    console.warn("[WhatsApp webhook] No pending booking for agency:", agency.id);
    return;
  }

  if (reply === "YES") {
    await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    // Notify the renter
    await notifyRenter({
      supabase,
      renterId: booking.renter_id,
      bookingId: booking.id,
      message: `✅ *Your car is confirmed!*\n\nThe agency has confirmed your booking request.\n\nPay Rs. 1,000 to lock it in: ${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking.id}`,
    });
  } else {
    await supabase
      .from("bookings")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    // Notify the renter
    await notifyRenter({
      supabase,
      renterId: booking.renter_id,
      bookingId: booking.id,
      message: `❌ *Booking declined*\n\nUnfortunately the agency couldn't fulfil this request. No payment was taken.\n\nFind another vehicle: ${process.env.NEXT_PUBLIC_APP_URL}/vehicles`,
    });
  }
}

async function notifyRenter({
  supabase,
  renterId,
  bookingId,
  message,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  renterId: string;
  bookingId: string;
  message: string;
}) {
  const { data: renter } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", renterId)
    .single();

  if (!renter?.phone) return;

  const normalisedPhone = renter.phone.replace(/\D/g, "");

  try {
    await sendWhatsAppText({ to: normalisedPhone, text: message });
  } catch (err) {
    // Non-fatal — booking state is already updated
    console.error("[WhatsApp webhook] Failed to notify renter:", bookingId, err);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WhatsAppWebhookPayload {
  object: string;
  entry?: {
    changes?: {
      value?: {
        messages?: {
          from: string;
          type: string;
          text?: { body: string };
        }[];
      };
    }[];
  }[];
}
