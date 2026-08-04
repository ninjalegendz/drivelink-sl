import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractKeyFromUrl } from "@/lib/storage/r2";

// POST /api/account/kyc
// body: { nicUrl: string, selfieUrl: string }
//
// The renter's KYC submission. Replaces the old client-side write of
// kyc_status="pending": kyc_status is a protected column (only the service
// role may set it), so the browser can no longer flip its own verification
// state. The route re-checks that both uploaded objects live under this
// user's own kyc/<uid>/ prefix before recording them, so a caller can't
// claim someone else's uploaded document.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ nicUrl: string; selfieUrl: string }>;
  const nicUrl    = typeof body.nicUrl === "string" ? body.nicUrl : null;
  const selfieUrl = typeof body.selfieUrl === "string" ? body.selfieUrl : null;
  if (!nicUrl || !selfieUrl) {
    return NextResponse.json({ error: "Both an NIC photo and a selfie are required." }, { status: 400 });
  }

  // Every referenced object must be one this user just uploaded: key must be
  // exactly kyc/<their-uid>/…  (extractKeyFromUrl returns null for foreign URLs).
  const ownPrefix = `kyc/${user.id}/`;
  for (const url of [nicUrl, selfieUrl]) {
    const key = extractKeyFromUrl(url);
    if (!key || !key.startsWith(ownPrefix)) {
      return NextResponse.json({ error: "Those uploads don't belong to your account." }, { status: 400 });
    }
  }

  const service = await createServiceClient();
  // Don't clobber an already-verified user if they somehow re-post.
  const { error } = await service
    .from("profiles")
    .update({ nic_url: nicUrl, selfie_url: selfieUrl, kyc_status: "pending" })
    .eq("id", user.id)
    .in("kyc_status", ["unverified", "rejected", "pending"]);

  if (error) {
    console.error("[account kyc submit]", error);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
