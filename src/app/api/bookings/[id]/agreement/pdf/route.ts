import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildAgreementPdf } from "@/lib/booking/agreement-pdf";
import type { AgreementTerms } from "@/lib/booking/agreement";
import { canActOnAgency } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

// GET /api/bookings/{id}/agreement/pdf — either party (or admin) downloads the
// immutable agreement as a self-contained, fingerprinted PDF (TRUST-007).
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, agencies!inner(owner_id)")
    .eq("id", id)
    .single();
  const bk = bookingRow as { renter_id: string; agency_id: string; agencies: { owner_id: string } | null } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  let ok = bk.renter_id === user.id || (await canActOnAgency(service, user.id, bk.agency_id));
  if (!ok) {
    const { data: me } = await service.from("profiles").select("role").eq("id", user.id).single();
    ok = (me as { role?: string } | null)?.role === "admin";
  }
  if (!ok) return NextResponse.json({ error: "Not your booking" }, { status: 403 });

  const { data: agr } = await service
    .from("booking_agreements")
    .select("terms, renter_accepted_at, owner_accepted_at, terms_hash")
    .eq("booking_id", id)
    .maybeSingle();
  const a = agr as {
    terms: AgreementTerms; renter_accepted_at: string | null;
    owner_accepted_at: string | null; terms_hash: string | null;
  } | null;
  if (!a) return NextResponse.json({ error: "No agreement for this booking yet." }, { status: 404 });

  const pdf = await buildAgreementPdf(a.terms, {
    bookingRef: id.slice(0, 8).toUpperCase(),
    renterAcceptedAt: a.renter_accepted_at,
    ownerAcceptedAt: a.owner_accepted_at,
    termsHash: a.terms_hash,
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="drivelink-agreement-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
