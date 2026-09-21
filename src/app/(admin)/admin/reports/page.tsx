import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { ReportActions } from "@/components/admin/ReportActions";

const CATEGORY_LABEL: Record<string, string> = {
  fake_or_stolen: "Fake / stolen", wrong_info: "Wrong info", scam: "Scam",
  duplicate: "Duplicate", inappropriate: "Inappropriate", other: "Other",
};

// ADMIN-003 - triage queue for reported listings / pages / accounts.
export default async function AdminReportsPage() {
  const service = await createServiceClient(); // (admin) layout enforces the role

  const { data } = await service
    .from("content_reports")
    .select("id, target_type, target_id, category, detail, status, created_at, reporter:profiles!reporter_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const reports = (data ?? []) as unknown as {
    id: string; target_type: string; target_id: string; category: string;
    detail: string | null; status: string; created_at: string;
    reporter: { full_name: string } | null;
  }[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Reports</h1>
      <p className="text-slate-600 text-sm mb-6">Listings, pages and accounts reported by users.</p>

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="slate">{r.target_type}</Badge>
                  <Badge variant="yellow">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                  {r.status === "open"      && <Badge variant="red">Open</Badge>}
                  {r.status === "reviewed"  && <Badge variant="green">Actioned</Badge>}
                  {r.status === "dismissed" && <Badge variant="slate">Dismissed</Badge>}
                </div>
                {r.detail && <p className="text-slate-700 text-sm">{r.detail}</p>}
                <div className="flex gap-3 mt-1 text-xs text-slate-500">
                  <span>By {r.reporter?.full_name ?? "-"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString("en-LK")}</span>
                  {r.target_type === "vehicle" && (
                    <Link href={`/admin/vehicles`} className="inline-flex min-h-11 items-center text-blue-600 hover:underline">Open listings</Link>
                  )}
                </div>
              </div>
              {r.status === "open" && <ReportActions reportId={r.id} />}
            </div>
          </div>
        ))}
        {reports.length === 0 && <div className="text-center py-16 text-slate-500">No reports.</div>}
      </div>
    </div>
  );
}
