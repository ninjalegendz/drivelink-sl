import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getWhatsAppQr } from "@/lib/whatsapp/client";

// GET /api/admin/whatsapp/qr, returns the current pairing QR (data-URL) while
// the sender number isn't linked yet.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  return NextResponse.json(await getWhatsAppQr());
}
