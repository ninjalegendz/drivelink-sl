import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchDiditSession, mapDiditStatus } from "@/lib/didit/client";

// POST /api/didit/sync  body: { userId }
//
// Admin-only. Reads the user's stored didit_session_id, fetches the
// latest status from Didit, and updates profiles.kyc_status. Used when
// the webhook didn't fire (manual admin decision in the Didit dashboard,
// misconfigured webhook URL, etc.).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((callerProfile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const service = await createServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("didit_session_id")
    .eq("id", userId)
    .single();
  const sessionId = (target as { didit_session_id?: string | null } | null)?.didit_session_id;
  if (!sessionId) {
    return NextResponse.json(
      { error: "No Didit session on file for this user yet. They need to start verification first." },
      { status: 400 }
    );
  }

  let session;
  try {
    session = await fetchDiditSession(sessionId);
  } catch (err) {
    console.error("[didit sync]", err);
    return NextResponse.json({ error: "Couldn't fetch session from Didit." }, { status: 502 });
  }

  const newStatus = mapDiditStatus(session.status);
  await service.from("profiles").update({ kyc_status: newStatus }).eq("id", userId);

  return NextResponse.json({ ok: true, kyc_status: newStatus, didit_status: session.status });
}
