import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ACTIVE_PAGE_COOKIE } from "@/lib/pages/active-page";
import { isValidSLPhone, toInternationalSL } from "@/lib/auth/phone-format";
import { isEmailLike } from "@/lib/auth/identifier";
import { containsPublicContactDetails, PUBLIC_CONTACT_ERROR } from "@/lib/content/public-contact";
import type { RentalPageRow } from "@/types/queries";

// POST /api/pages
// body: { name, page_type: 'personal'|'business', city, whatsapp_number,
//         description?, address?, email?, business_reg_no? }
//
// Creates a new Rental Page (a row in `agencies`, the table keeps its
// internal name) for the signed-in account. There is no lifetime page limit;
// the database applies a short, atomic creation-rate guard against fake-page
// bursts. Requires identity verification (KYC) and a clean standing first.
const PAGE_TYPES = new Set(["personal", "business"]);
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // `is_blacklisted` is deliberately not selectable by a browser-session
  // client. The authenticated user above pins this private eligibility read
  // to the caller before the service client is used.
  const service = await createServiceClient();
  // Eligibility gate before we even look at the body, an ineligible account
  // should see the real reason, not a validation error.
  const { data: profileRow } = await service
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
  // Email is optional. Requiring it stopped owners who run everything from a
  // phone; notices fall back to the page's verified number and the account's
  // own email. A supplied email still has to look like one.
  if (emailIn && !isEmailLike(emailIn)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }
  if (containsPublicContactDetails(name, description)) {
    return NextResponse.json({ error: PUBLIC_CONTACT_ERROR }, { status: 400 });
  }

  const intlPhone = toInternationalSL(whatsappIn)!;

  // Creation runs on the service client: is_verified is a protected column
  // and the database function pins ownership to this authenticated user.

  // Public /pages/<slug> address (PAGE-008): slugify the name + a short random
  // suffix so two same-named pages don't collide.
  const slug = `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page"}-${crypto.randomUUID().slice(0, 6)}`;

  // is_verified: personal pages are auto-approved to operate once the
  // owner's KYC is verified (already true, checked above). Business pages
  // wait for an admin to review the registration certificate.
  const { data: page, error: insertError } = await service.rpc("create_rental_page", {
    p_owner_id: user.id,
    p_name: name,
    p_slug: slug,
    p_page_type: pageType,
    p_city: city,
    p_whatsapp_number: intlPhone,
    p_description: description,
    p_address: address,
    p_email: emailIn,
    p_business_reg_no: businessRegNo,
  });

  if (insertError || !page) {
    console.error("[pages create] insert", insertError);
    return NextResponse.json({ error: "Couldn't create Rental Page." }, { status: 500 });
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
