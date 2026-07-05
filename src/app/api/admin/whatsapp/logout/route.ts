import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { whatsAppLogout } from "@/lib/whatsapp/client";

// POST /api/admin/whatsapp/logout, unlinks the sender number and re-pairs.
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  return NextResponse.json(await whatsAppLogout());
}
