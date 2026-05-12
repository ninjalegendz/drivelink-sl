import Link from "next/link";
import { Receipt, ChevronRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/vehicles/format";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

function monthLabel(iso: string): string {
  return new Date(iso + "-01").toLocaleDateString("en-LK", { year: "numeric", month: "long" });
}

function thisMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminInvoicesPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams;
  const month = monthParam ?? thisMonthIso();
  const [year, mm] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mm - 1, 1)).toISOString();
  const monthEnd   = new Date(Date.UTC(year, mm,     1)).toISOString();

  const supabase = await createClient();

  // Completed bookings inside this month, with agency join. RLS allows
  // admins via the "Admins can manage all bookings" policy.
  const { data: bookingData } = await supabase
    .from("bookings")
    .select("id, agency_id, completed_at, agency_fee_lkr, agency_fee_collected_at, agencies(name)")
    .eq("status", "completed")
    .gte("completed_at", monthStart)
    .lt("completed_at", monthEnd)
    .order("completed_at", { ascending: false });

  const rows = (bookingData ?? []) as unknown as {
    id: string;
    agency_id: string;
    completed_at: string;
    agency_fee_lkr: number;
    agency_fee_collected_at: string | null;
    agencies: { name: string } | null;
  }[];

  // Aggregate per agency
  type Agg = { agency_id: string; name: string; completed: number; total: number; collected: number; outstanding: number };
  const byAgency = new Map<string, Agg>();
  for (const r of rows) {
    const a = byAgency.get(r.agency_id) ?? {
      agency_id:   r.agency_id,
      name:        r.agencies?.name ?? "Unknown",
      completed:   0,
      total:       0,
      collected:   0,
      outstanding: 0,
    };
    a.completed   += 1;
    a.total       += r.agency_fee_lkr;
    if (r.agency_fee_collected_at) a.collected   += r.agency_fee_lkr;
    else                            a.outstanding += r.agency_fee_lkr;
    byAgency.set(r.agency_id, a);
  }
  const agencies = Array.from(byAgency.values()).sort((a, b) => b.outstanding - a.outstanding);

  // Month nav — previous N months
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const totalCollected   = agencies.reduce((s, a) => s + a.collected,   0);
  const totalOutstanding = agencies.reduce((s, a) => s + a.outstanding, 0);
  const totalCompleted   = agencies.reduce((s, a) => s + a.completed,   0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={22} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Agency invoices</h1>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        Rs. 200 per completed booking. Renter lock-in (Rs. 500) is collected at booking confirmation
        — separately, via the slip-upload flow.
      </p>

      {/* Month picker */}
      <div className="flex gap-1 mb-5 bg-slate-900 rounded-xl p-1 w-fit flex-wrap">
        {months.map((m) => (
          <Link
            key={m}
            href={`/admin/invoices?month=${m}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              m === month ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-white"
            }`}
          >
            {monthLabel(m)}
          </Link>
        ))}
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Bookings completed", value: totalCompleted,                                color: "text-white" },
          { label: "Total fees",         value: formatLKR(totalCollected + totalOutstanding),  color: "text-white" },
          { label: "Collected",          value: formatLKR(totalCollected),                     color: "text-emerald-400" },
          { label: "Outstanding",        value: formatLKR(totalOutstanding),                   color: totalOutstanding > 0 ? "text-amber-400" : "text-slate-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
            <p className={`text-lg font-semibold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {agencies.length === 0 ? (
        <div className="bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-500 text-sm">
          No completed bookings in {monthLabel(month)}.
        </div>
      ) : (
        <div className="space-y-2">
          {agencies.map((a) => (
            <Link
              key={a.agency_id}
              href={`/admin/invoices/${a.agency_id}?month=${month}`}
              className="block spring-hover bg-slate-900 border border-slate-200 shadow-sm hover:border-amber-300 rounded-2xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{a.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {a.completed} booking{a.completed === 1 ? "" : "s"} completed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold">{formatLKR(a.total)}</p>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    {a.outstanding === 0 ? (
                      <Badge variant="green"><CheckCircle2 size={10} /> All paid</Badge>
                    ) : (
                      <Badge variant="yellow">{formatLKR(a.outstanding)} due</Badge>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-500 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
