import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractKeyFromUrl } from "@/lib/storage/r2";
import { logEvent } from "@/lib/activity/log";

type LicenseJurisdiction = "sri_lanka" | "foreign";

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// POST /api/account/license
// The browser never writes licence-review state directly. It can only submit
// two private files plus the facts a reviewer needs to check eligibility.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    frontUrl: string;
    backUrl: string;
    dateOfBirth: string;
    issuedOn: string;
    expiresOn: string;
    jurisdiction: LicenseJurisdiction;
  }>;
  const frontUrl = typeof body.frontUrl === "string" ? body.frontUrl : null;
  const backUrl = typeof body.backUrl === "string" ? body.backUrl : null;
  if (!frontUrl || !backUrl) {
    return NextResponse.json({ error: "Upload both sides of your driving licence." }, { status: 400 });
  }
  if (!isDateOnly(body.dateOfBirth) || !isDateOnly(body.issuedOn) || !isDateOnly(body.expiresOn)) {
    return NextResponse.json({ error: "Enter your date of birth, the licence issue date, and the expiry date." }, { status: 400 });
  }
  if (!["sri_lanka", "foreign"].includes(body.jurisdiction ?? "")) {
    return NextResponse.json({ error: "Tell us whether your driving licence was issued in Sri Lanka or abroad." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (
    body.dateOfBirth >= today
    || body.issuedOn > today
    || body.expiresOn < today
    || body.issuedOn < body.dateOfBirth
    || body.expiresOn < body.issuedOn
  ) {
    return NextResponse.json({ error: "Check the dates on your driving licence and try again." }, { status: 400 });
  }

  const ownPrefix = `kyc/${user.id}/`;
  for (const url of [frontUrl, backUrl]) {
    const key = extractKeyFromUrl(url);
    if (!key || !key.startsWith(ownPrefix)) {
      return NextResponse.json({ error: "Those uploads do not belong to your account." }, { status: 400 });
    }
  }

  const service = await createServiceClient();
  const { error } = await service.from("profiles").update({
    license_front_url: frontUrl,
    license_back_url: backUrl,
    date_of_birth: body.dateOfBirth,
    license_issued_on: body.issuedOn,
    license_expires_on: body.expiresOn,
    license_jurisdiction: body.jurisdiction,
    license_review_status: "pending",
    license_submitted_at: new Date().toISOString(),
    license_reviewed_at: null,
    license_reviewed_by: null,
    license_review_note: null,
  }).eq("id", user.id);
  if (error) {
    console.error("[account license submit]", error);
    return NextResponse.json({ error: "Licence submission failed. Please try again." }, { status: 500 });
  }

  await logEvent(service, {
    actorId: user.id,
    actorRole: "renter",
    eventType: "renter.license_submitted",
    subjectKind: "renter",
    subjectId: user.id,
    relatedRenterId: user.id,
  });

  return NextResponse.json({ ok: true, reviewStatus: "pending" });
}
