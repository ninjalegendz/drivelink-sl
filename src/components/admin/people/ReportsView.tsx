import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Flag } from "lucide-react";
import { formatInstantDay } from "@/lib/dates/display";
import { ReportActions } from "@/components/admin/ReportActions";

const CATEGORY_LABEL: Record<string, string> = {
  fake_or_stolen: "Fake / stolen", wrong_info: "Wrong info", scam: "Scam",
  duplicate: "Duplicate", inappropriate: "Inappropriate", other: "Other",
};

export interface ContentReportRow {
  id: string;
  target_type: string;
  target_id: string;
  category: string;
  detail: string | null;
  status: string;
  created_at: string;
  reporter: { full_name: string } | null;
}

export interface ReportsViewProps {
  reports: ContentReportRow[];
}

const STATUS_BADGE: Record<string, { variant: "red" | "green" | "slate"; label: string }> = {
  open:       { variant: "red",   label: "Open" },
  reviewed:   { variant: "green", label: "Actioned" },
  dismissed:  { variant: "slate", label: "Dismissed" },
};

/**
 * Reports queue: listings, pages and accounts flagged by users, waiting on an
 * admin decision. Presentation only: the query and the (admin) role check
 * live in (admin)/admin/reports/page.tsx unchanged.
 */
export function ReportsView({ reports }: ReportsViewProps) {
  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Reports"
        description="Listings, pages and accounts reported by users."
        eyebrow={openCount > 0 ? `${openCount} open` : undefined}
      />

      {reports.length === 0 ? (
        <Card padding="lg">
          <EmptyState bare icon={<Flag size={22} className="text-slate-400" strokeWidth={1.5} />} title="No reports" />
        </Card>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="px-4 py-3 text-left">Report</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reporter</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Decision</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => {
                  const status = STATUS_BADGE[r.status] ?? { variant: "slate" as const, label: r.status };
                  return (
                    <tr key={r.id} className="align-top transition-colors hover:bg-slate-50/60">
                      <td className="max-w-md px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="slate">{r.target_type}</Badge>
                          <Badge variant="amber">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                        </div>
                        {r.detail && <p className="mt-1.5 text-slate-700">{r.detail}</p>}
                        {r.target_type === "vehicle" && (
                          <Link href="/admin/vehicles" className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:text-blue-800">
                            Open listings
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{r.reporter?.full_name ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatInstantDay(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">{r.status === "open" && <ReportActions reportId={r.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {reports.map((r) => {
              const status = STATUS_BADGE[r.status] ?? { variant: "slate" as const, label: r.status };
              return (
                <Card key={r.id} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="slate">{r.target_type}</Badge>
                      <Badge variant="amber">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {r.detail && <p className="mt-2 text-sm text-slate-700">{r.detail}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>By {r.reporter?.full_name ?? "-"}</span>
                    <span>{formatInstantDay(r.created_at)}</span>
                    {r.target_type === "vehicle" && (
                      <Link href="/admin/vehicles" className="font-semibold text-blue-700 hover:text-blue-800">Open listings</Link>
                    )}
                  </div>
                  {r.status === "open" && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <ReportActions reportId={r.id} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
