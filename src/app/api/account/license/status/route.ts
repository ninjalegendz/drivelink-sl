import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// The booking form needs only non-document status information. File URLs and
// dates stay out of this response, so a listing page cannot accidentally
// expose personal licence information.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("license_review_status, license_jurisdiction")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ signedIn: true, reviewStatus: "not_submitted", jurisdiction: null });

  const profile = data as { license_review_status: string | null; license_jurisdiction: "sri_lanka" | "foreign" | null };
  return NextResponse.json({
    signedIn: true,
    reviewStatus: profile.license_review_status ?? "not_submitted",
    jurisdiction: profile.license_jurisdiction,
  });
}
