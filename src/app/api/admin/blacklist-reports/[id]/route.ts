import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

// POST /api/admin/blacklist-reports/{id}   body: { approve: boolean }
//
// Reviews a renter blacklist report. Runs on the service client because
// blacklisting a renter writes profiles.is_blacklisted - a protected column
// no browser session may set. Approving also fixes two long-standing bugs:
//   - it matches profiles.nic_number (the actual NIC), not nic_url (a
//     storage URL that never contains the NIC), and
//   - it compares a NORMALISED NIC (case-folded, punctuation stripped) so
//     "901234567V", "901234567 v" and "901234567-V" all resolve to the
//     same identity.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ approve: boolean }>;
  if (typeof body.approve !== "boolean") {
    return NextResponse.json({ error: "approve (boolean) is required." }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: reportRow } = await service
    .from("blacklist_reports")
    .select("id, reported_nic, approved")
    .eq("id", id)
    .single();
  const report = reportRow as { id: string; reported_nic: string; approved: boolean | null } | null;
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.approved !== null) {
    return NextResponse.json({ error: "This report has already been reviewed." }, { status: 409 });
  }

  const { error: reviewError } = await service
    .from("blacklist_reports")
    .update({ approved: body.approve, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .is("approved", null);
  if (reviewError) {
    console.error("[admin blacklist-report] review update", reviewError);
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  let matched = 0;
  if (body.approve) {
    const normalized = report.reported_nic.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (normalized.length >= 6) {
      // Match on the normalised stored nic_number, not the raw text/URL.
      // Small table, so normalise + compare in JS rather than depend on a
      // DB-side normalising expression.
      const { data: rows } = await service
        .from("profiles")
        .select("id, nic_number")
        .not("nic_number", "is", null);
      const toBlock = ((rows ?? []) as { id: string; nic_number: string | null }[])
        .filter((p) => (p.nic_number ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() === normalized)
        .map((p) => p.id);
      if (toBlock.length > 0) {
        const { error: blockError } = await service
          .from("profiles")
          .update({
            is_blacklisted:   true,
            blacklist_reason: `NIC ${report.reported_nic} flagged for vehicle damage/theft (report ${id.slice(0, 8)}).`,
          })
          .in("id", toBlock);
        if (blockError) {
          console.error("[admin blacklist-report] block update", blockError);
          return NextResponse.json({ error: blockError.message }, { status: 500 });
        }
        matched = toBlock.length;
      }
    }
  }

  await logEvent(service, {
    actorId:     auth.user.id,
    actorRole:   "admin",
    eventType:   body.approve ? "admin.blacklist_report_approved" : "admin.blacklist_report_dismissed",
    subjectKind: "renter",
    subjectId:   id,
    metadata:    { reported_nic: report.reported_nic, matched_profiles: matched },
  });

  return NextResponse.json({ ok: true, matched });
}
