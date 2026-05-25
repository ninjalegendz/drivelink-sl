import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDiditSession } from "@/lib/didit/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const redirectPath: string = body.redirectPath ?? "/account?didit=done";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Pull the user's contact info so Didit can notify them on decision.
  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", user.id)
    .single();
  const p = profile as { full_name: string; phone: string; email: string | null } | null;

  try {
    const session = await createDiditSession({
      userId:      user.id,
      redirectUrl: `${appUrl}${redirectPath}`,
      email:       p?.email ?? null,
      phoneNumber: p?.phone ?? null,
      fullName:    p?.full_name ?? null,
    });

    // Stash the session id so admins can fetch latest status if the
    // webhook misses or fires late, and flip kyc_status to "pending" so
    // the UI honestly reflects "in review" the moment the user starts
    // verifying — instead of pretending nothing happened until the Didit
    // webhook arrives (which sometimes never does). The eq filter on
    // status prevents downgrading an already-verified user if they
    // somehow hit this endpoint again.
    if (session.session_id) {
      await service
        .from("profiles")
        .update({
          didit_session_id: session.session_id,
          kyc_status:       "pending",
        })
        .eq("id", user.id)
        .in("kyc_status", ["unverified", "rejected", "pending"]);
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Didit start]", err);
    return NextResponse.json({ error: "Failed to create verification session" }, { status: 500 });
  }
}
