const GRAPH_URL = "https://graph.facebook.com/v21.0";

interface TextMessage {
  to: string;       // phone number with country code, no +, no spaces e.g. "94771234567"
  text: string;
}

export async function sendWhatsAppText({ to, text }: TextMessage) {
  const res = await fetch(
    `${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp send error]", err);
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }

  return res.json();
}

// Builds the confirmation ping message sent to an agency when a new booking request arrives
export function buildAgencyPingMessage({
  bookingId,
  renterName,
  vehicleName,
  startDate,
  endDate,
  totalDays,
  appUrl,
}: {
  bookingId: string;
  renterName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  appUrl: string;
}) {
  const ref = bookingId.slice(0, 8).toUpperCase();

  return (
    `*DriveLink SL — New Booking Request* 🚗\n\n` +
    `*Ref:* ${ref}\n` +
    `*Vehicle:* ${vehicleName}\n` +
    `*Renter:* ${renterName} (ID Verified)\n` +
    `*Dates:* ${startDate} → ${endDate} (${totalDays} day${totalDays !== 1 ? "s" : ""})\n\n` +
    `Is this vehicle available?\n\n` +
    `Reply *YES* to confirm\n` +
    `Reply *NO* to decline\n\n` +
    `View booking: ${appUrl}/dashboard/bookings`
  );
}
