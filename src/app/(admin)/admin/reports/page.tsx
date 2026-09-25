import { createServiceClient } from "@/lib/supabase/server";
import { ReportsView, type ContentReportRow } from "@/components/admin/people/ReportsView";

// ADMIN-003 - triage queue for reported listings / pages / accounts.
export default async function AdminReportsPage() {
  const service = await createServiceClient(); // (admin) layout enforces the role

  const { data } = await service
    .from("content_reports")
    .select("id, target_type, target_id, category, detail, status, created_at, reporter:profiles!reporter_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const reports = (data ?? []) as unknown as ContentReportRow[];

  return <ReportsView reports={reports} />;
}
