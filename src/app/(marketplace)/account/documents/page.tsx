import { redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AccountDocumentsView, type SharingBooking, type AccessLogRow, type ExportRow } from "@/components/account/AccountDocumentsView";

export const metadata = { title: "Document sharing history" };

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ page?: string }>;
}
export default async function AccountDocumentsPage({ searchParams }: Props) {
  const query = await searchParams;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/documents");
  await requireVerifiedIdentity("/account/documents");

  // These service reads are each pinned to the authenticated renter. They
  // preserve historical page names without reopening raw Rental Page contact
  // columns to every signed-in database client.
  const service = await createServiceClient();
  const [sharingResult, logResult, exportResult] = await Promise.all([
    service
      .from("bookings")
      .select("id, start_date, end_date, doc_share_consent_at, agencies(name), vehicles(make, model, year)")
      .eq("renter_id", user.id)
      .not("doc_share_consent_at", "is", null)
      .in("status", ["confirmed", "payment_pending", "active"])
      .order("doc_share_consent_at", { ascending: false }),
    service
      .from("document_access_log")
      .select("id, booking_id, agency_id, document, viewer_name, viewer_role, purpose, outcome, created_at, bookings(agencies(name))", { count: "exact" })
      .eq("renter_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    service
      .from("evidence_exports")
      .select("id, booking_id, export_kind, reason, preparation_status, available_until, created_at, bookings!inner(renter_id, agencies(name))")
      .eq("bookings.renter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const sharing = (sharingResult.data ?? []) as unknown as SharingBooking[];
  const log = (logResult.data ?? []) as unknown as AccessLogRow[];
  const exports = (exportResult.data ?? []) as unknown as ExportRow[];
  const totalRows = logResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const hasError = Boolean(sharingResult.error || logResult.error || exportResult.error);

  return (
    <AccountDocumentsView
      sharing={sharing}
      exports={exports}
      log={log}
      totalRows={totalRows}
      page={page}
      totalPages={totalPages}
      hasError={hasError}
    />
  );
}
