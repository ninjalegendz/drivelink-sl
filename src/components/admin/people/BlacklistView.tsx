import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldAlert } from "lucide-react";
import { formatInstantDay } from "@/lib/dates/display";
import { BlacklistActions } from "@/components/admin/BlacklistActions";

export interface BlacklistReportRow {
  id: string;
  reported_nic: string;
  reason: string;
  approved: boolean | null;
  created_at: string;
  agencies: { name: string } | null;
  bookings: { id: string } | null;
}

export interface BlacklistViewProps {
  reports: BlacklistReportRow[];
}

/**
 * Blacklist queue: NIC reports filed by Rental Pages after a bad rental,
 * waiting on an admin decision. Presentation only: the query and the (admin)
 * role check live in (admin)/admin/blacklist/page.tsx unchanged.
 */
export function BlacklistView({ reports }: BlacklistViewProps) {
  const pendingCount = reports.filter((r) => r.approved === null).length;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Blacklist"
        description="Reported by Rental Pages after vehicle damage or theft. Approved NICs are blocked from future bookings."
        eyebrow={pendingCount > 0 ? `${pendingCount} awaiting review` : undefined}
      />

      {reports.length === 0 ? (
        <Card padding="lg">
          <EmptyState bare icon={<ShieldAlert size={22} className="text-slate-400" strokeWidth={1.5} />} title="No blacklist reports" />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="px-4 py-3 text-left">NIC</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Reported by</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Decision</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="align-top transition-colors hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">{r.reported_nic}</td>
                    <td className="px-4 py-3">
                      {r.approved === null && <Badge variant="amber">Pending review</Badge>}
                      {r.approved === true && <Badge variant="red">Blacklisted</Badge>}
                      {r.approved === false && <Badge variant="slate">Dismissed</Badge>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">{r.reason}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.agencies?.name ?? "Unknown"}
                      {r.bookings?.id && <span className="block font-mono text-xs text-slate-400">Booking {r.bookings.id.slice(0, 8).toUpperCase()}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatInstantDay(r.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.approved === null && <BlacklistActions reportId={r.id} reportedNic={r.reported_nic} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {reports.map((r) => (
              <Card key={r.id} padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-900">{r.reported_nic}</p>
                    <p className="mt-1 text-sm text-slate-700">{r.reason}</p>
                  </div>
                  {r.approved === null && <Badge variant="amber">Pending</Badge>}
                  {r.approved === true && <Badge variant="red">Blacklisted</Badge>}
                  {r.approved === false && <Badge variant="slate">Dismissed</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>Reported by {r.agencies?.name ?? "Unknown"}</span>
                  {r.bookings?.id && <span className="font-mono">Booking {r.bookings.id.slice(0, 8).toUpperCase()}</span>}
                  <span>{formatInstantDay(r.created_at)}</span>
                </div>
                {r.approved === null && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <BlacklistActions reportId={r.id} reportedNic={r.reported_nic} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
