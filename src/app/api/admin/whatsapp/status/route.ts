import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getWhatsAppStatus } from "@/lib/whatsapp/client";

// GET /api/admin/whatsapp/status, admin-only proxy to the Baileys service so
// the service token stays server-side.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  return NextResponse.json(await getWhatsAppStatus());
}
