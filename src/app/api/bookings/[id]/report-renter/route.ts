import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";

// POST /api/bookings/[id]/report-renter
// body: { reason: string }
//
// Page-owner flags a renter to DriveLink admin for a serious issue
// (non-return, fraud, damage with refusal to settle). Creates a
// blacklist_reports row for the existing admin review UI
// (src/app/(admin)/admin/blacklist + BlacklistActions) — this route is
// only the insert path, admin approval is what actually flips
// profiles.is_blacklisted, never touched here.
//
// Defamation-safe by design: nothing here notifies the renter or surfaces
// the report to them. Reports stay internal until an admin reviews the
// booking's evidence (agreement, inspections, incidents) and approves or
// dismisses.
//
// Goes through the service client: blacklist_reports has RLS enabled
// (migration 001) with no insert policy for agencies at all, the app is
// the only writer.

const MIN_REASON = 20;
const MAX_REASON = 2000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ reason: string }>;
  const reason = body.reason?.trim() ?? "";
  if (reason.length < MIN_REASON || reason.length > MAX_REASON) {
    return NextResponse.json(
      {
        error: `This is a serious accusation — describe what happened in at least ${MIN_REASON} characters (max ${MAX_REASON}).`,
      },
      { status: 400 },
    );
  }

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, overdue_critical_at, agencies(owner_id), profiles:renter_id(nic_number)")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id: string; renter_id: string; agency_id: string; status: string; overdue_critical_at: string | null;
    agencies: { owner_id: string } | null;
    profiles: { nic_number: string | null } | null;
  };
  const b = bookingRow as unknown as Joined | null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Party check: only the owner of the page the booking belongs to.
  if (b.agencies?.owner_id !== user.id) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }

  // Status check: completed, disputed, or overdue-critical (still 'active'
  // status, but overdue_critical_at is stamped by the cron ladder once a
  // renter has gone dark on a return for 24h+, migration 051/052).
  const reportable = b.status === "completed" || b.status === "disputed" || !!b.overdue_critical_at;
  if (!reportable) {
    return NextResponse.json(
      { error: "Renters can only be reported on a completed, disputed, or severely overdue booking." },
      { status: 400 },
    );
  }

  // One report per booking.
  const { data: existing } = await service
    .from("blacklist_reports")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A report has already been filed for this booking." }, { status: 409 });
  }

  // The renter's NIC comes from Didit KYC (profiles.nic_number). If it's
  // somehow missing, still file the report so the page isn't stuck — admin
  // can resolve identity manually from the booking record.
  const reportedNic = b.profiles?.nic_number || `UNKNOWN-${b.renter_id.slice(0, 8).toUpperCase()}`;

  const { error: insertError } = await service.from("blacklist_reports").insert({
    reported_nic: reportedNic,
    reported_by:  b.agency_id,
    booking_id:   b.id,
    reason,
  });
  if (insertError) {
    console.error("[report-renter] insert failed", insertError);
    return NextResponse.json({ error: "Couldn't file the report. Try again." }, { status: 500 });
  }

  await logEvent(service, {
    actorId:          user.id,
    actorRole:        "agency_owner",
    eventType:        "blacklist.report_filed",
    subjectKind:      "booking",
    subjectId:        b.id,
    relatedRenterId:  b.renter_id,
    relatedAgencyId:  b.agency_id,
    relatedBookingId: b.id,
    metadata:         { reported_nic: reportedNic },
  });

  // Deliberately no notification to the renter here — see file header.

  return NextResponse.json({ ok: true }, { status: 201 });
}
