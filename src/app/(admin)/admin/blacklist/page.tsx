import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { BlacklistActions } from "@/components/admin/BlacklistActions";

export default async function AdminBlacklistPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("blacklist_reports")
    .select("id, reported_nic, reason, approved, created_at, agencies(name), bookings(id)")
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as unknown as {
    id: string;
    reported_nic: string;
    reason: string;
    approved: boolean | null;
    created_at: string;
    agencies: { name: string } | null;
    bookings: { id: string } | null;
  }[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Blacklist Reports</h1>
      <p className="text-slate-400 text-sm mb-6">
        Reported by agencies after vehicle damage or theft. Approved NICs are blocked from future bookings.
      </p>

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-mono text-white font-semibold">{r.reported_nic}</p>
                  {r.approved === null && <Badge variant="yellow">Pending review</Badge>}
                  {r.approved === true && <Badge variant="red">Blacklisted</Badge>}
                  {r.approved === false && <Badge variant="slate">Dismissed</Badge>}
                </div>
                <p className="text-slate-400 text-sm">{r.reason}</p>
                <div className="flex gap-3 mt-1 text-xs text-slate-500">
                  <span>Reported by: {r.agencies?.name ?? "Unknown"}</span>
                  <span>Booking: {r.bookings?.id?.slice(0, 8).toUpperCase() ?? "—"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString("en-LK")}</span>
                </div>
              </div>
              {r.approved === null && <BlacklistActions reportId={r.id} reportedNic={r.reported_nic} />}
            </div>
          </div>
        ))}

        {reports.length === 0 && (
          <div className="text-center py-16 text-slate-500">No blacklist reports.</div>
        )}
      </div>
    </div>
  );
}
