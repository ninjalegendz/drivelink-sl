import { createServiceClient } from "@/lib/supabase/server";
import { BlacklistView, type BlacklistReportRow } from "@/components/admin/people/BlacklistView";

export default async function AdminBlacklistPage() {
  // Service client: blacklist_reports has RLS enabled with no admin SELECT
  // policy, so the session client silently returned an empty queue
  // (ADMIN-001). The (admin) layout already enforces the admin role - and
  // profiles.role is server-only since the column lockdown.
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("blacklist_reports")
    .select("id, reported_nic, reason, approved, created_at, agencies(name), bookings(id)")
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as unknown as BlacklistReportRow[];

  return <BlacklistView reports={reports} />;
}
