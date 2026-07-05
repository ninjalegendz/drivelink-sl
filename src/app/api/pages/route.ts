import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PAGE_COOKIE } from "@/lib/pages/active-page";
import { isValidSLPhone, toInternationalSL } from "@/lib/auth/phone-format";
import { isEmailLike } from "@/lib/auth/identifier";
import type { RentalPageRow } from "@/types/queries";

// POST /api/pages
// body: { name, page_type: 'personal'|'business', city, whatsapp_number,
//         description?, address?, email?, business_reg_no? }
//
// Creates a new Rental Page (a row in `agencies`, the table keeps its
// internal name) for the signed-in account. One account can own up to
// MAX_LIVE_PAGES pages. Requires identity verification (KYC) and a clean
// standing (not blacklisted) first.
const MAX_LIVE_PAGES = 5;
const PAGE_TYPES = new Set(["personal", "business"]);
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Eligibility gate before we even look at the body, an ineligible account
  // should see the real reason, not a validation error.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("kyc_status, is_blacklisted, role")
    .eq("id", user.id)
    .single();
  const profile = profileRow as { kyc_status: string; is_blacklisted: boolean; role: string } | null;

  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (profile.kyc_status !== "verified") {
    return NextResponse.json({ error: "Verify your identity before creating a Rental Page." }, { status: 403 });
  }
  if (profile.is_blacklisted) {
    return NextResponse.json({ error: "Account not eligible." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name:             string;
    page_type:        string;
    city:             string;
    whatsapp_number:  string;
    description:      string;
    address:          string;
    email:            string;
    business_reg_no:  string;
  }>;

  const name          = body.name?.trim() ?? "";
  const pageType      = body.page_type ?? "";
  const city          = body.city?.trim() ?? "";
  const whatsappIn    = body.whatsapp_number?.trim() ?? "";
  const description   = body.description?.trim() || null;
  const address        = body.address?.trim() || null;
  const emailIn       = body.email?.trim().toLowerCase() || null;
  const businessRegNo = body.business_reg_no?.trim() || null;

  if (name.length < 3 || name.length > 60) {
    return NextResponse.json({ error: "Page name must be 3-60 characters." }, { status: 400 });
  }
  if (!PAGE_TYPES.has(pageType)) {
    return NextResponse.json({ error: "Invalid page type." }, { status: 400 });
  }
  if (!city) {
    return NextResponse.json({ error: "Pick a city." }, { status: 400 });
  }
  if (!isValidSLPhone(whatsappIn)) {
    return NextResponse.json({ error: "Enter a valid WhatsApp number." }, { status: 400 });
  }
  if (emailIn && !isEmailLike(emailIn)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }

  const { count } = await supabase
    .from("agencies")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .is("deleted_at", null);
  if ((count ?? 0) >= MAX_LIVE_PAGES) {
    return NextResponse.json({ error: "You've reached the limit of 5 Rental Pages." }, { status: 400 });
  }

  const intlPhone = toInternationalSL(whatsappIn)!;

  // is_verified: personal pages are auto-approved to operate once the
  // owner's KYC is verified (already true, checked above). Business pages
  // wait for an admin to review the registration certificate.
  const { data: page, error: insertError } = await supabase
    .from("agencies")
    .insert({
      owner_id:        user.id,
      name,
      page_type:       pageType,
      city,
      whatsapp_number: intlPhone,
      description,
      address,
      email:           emailIn,
      business_reg_no: pageType === "business" ? businessRegNo : null,
      is_verified:     pageType === "personal",
    })
    .select("*")
    .single();

  if (insertError || !page) {
    console.error("[pages create] insert", insertError);
    return NextResponse.json({ error: "Couldn't create Rental Page." }, { status: 500 });
  }

  // Legacy compatibility signal used by navbar/redirects, do not touch admin roles.
  if (profile.role === "renter") {
    await supabase.from("profiles").update({ role: "agency_owner" }).eq("id", user.id);
  }

  const pageRow = page as unknown as RentalPageRow;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PAGE_COOKIE, pageRow.id, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   ONE_YEAR_SEC,
    secure:   process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ page: pageRow }, { status: 201 });
}
