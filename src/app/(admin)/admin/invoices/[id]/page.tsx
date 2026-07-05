import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/vehicles/format";
import { InvoiceCollectToggle } from "@/components/admin/InvoiceCollectToggle";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}

function thisMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(iso: string): string {
  return new Date(iso + "-01").toLocaleDateString("en-LK", { year: "numeric", month: "long" });
}

export default async function AdminAgencyInvoicePage({ params, searchParams }: Props) {
  const { id }    = await params;
  const { month: monthParam } = await searchParams;
  const month     = monthParam ?? thisMonthIso();
  const [year, mm] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mm - 1, 1)).toISOString();
  const monthEnd   = new Date(Date.UTC(year, mm,     1)).toISOString();

  const supabase = await createClient();

  const { data: agencyRow } = await supabase
    .from("agencies")
    .select("id, name, city, whatsapp_number")
    .eq("id", id)
    .single();
  const agency = agencyRow as { id: string; name: string; city: string; whatsapp_number: string } | null;
  if (!agency) notFound();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("id, completed_at, agency_fee_lkr, agency_fee_collected_at, vehicles(make, model, year), profiles(full_name)")
    .eq("agency_id", id)
    .eq("status", "completed")
    .gte("completed_at", monthStart)
    .lt("completed_at", monthEnd)
    .order("completed_at", { ascending: false });

  const bookings = (bookingsData ?? []) as unknown as {
    id: string;
    completed_at: string;
    agency_fee_lkr: number;
    agency_fee_collected_at: string | null;
    vehicles: { make: string; model: string; year: number } | null;
    profiles: { full_name: string } | null;
  }[];

  const total       = bookings.reduce((s, b) => s + b.agency_fee_lkr, 0);
  const collected   = bookings.filter((b) => b.agency_fee_collected_at).reduce((s, b) => s + b.agency_fee_lkr, 0);
  const outstanding = total - collected;

  return (
    <div>
      <Link
        href={`/admin/invoices?month=${month}`}
        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs mb-4"
      >
        <ArrowLeft size={12} /> Back to all invoices
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Receipt size={22} className="text-blue-600" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-slate-900">{agency.name}</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">
        {agency.city} · {agency.whatsapp_number} · {monthLabel(month)} invoice
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Total</p>
          <p className="text-slate-900 text-lg font-semibold mt-0.5">{formatLKR(total)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Collected</p>
          <p className="text-emerald-400 text-lg font-semibold mt-0.5">{formatLKR(collected)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Outstanding</p>
          <p className={`text-lg font-semibold mt-0.5 ${outstanding > 0 ? "text-blue-600" : "text-slate-500"}`}>
            {formatLKR(outstanding)}
          </p>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-500 text-sm">
          No completed bookings for {agency.name} in {monthLabel(month)}.
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-3 pr-4 font-medium">Ref</th>
                  <th className="pb-3 pr-4 font-medium">Vehicle</th>
                  <th className="pb-3 pr-4 font-medium">Renter</th>
                  <th className="pb-3 pr-4 font-medium">Completed</th>
                  <th className="pb-3 pr-4 font-medium">Fee</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{b.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-3 pr-4 text-slate-900">
                      {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{b.profiles?.full_name ?? "-"}</td>
                    <td className="py-3 pr-4 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(b.completed_at).toLocaleDateString("en-LK")}
                    </td>
                    <td className="py-3 pr-4 text-blue-600">{formatLKR(b.agency_fee_lkr)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {b.agency_fee_collected_at ? (
                          <Badge variant="green">Collected</Badge>
                        ) : (
                          <Badge variant="yellow">Due</Badge>
                        )}
                        <InvoiceCollectToggle
                          bookingId={b.id}
                          collected={Boolean(b.agency_fee_collected_at)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[11px] text-slate-500">{b.id.slice(0, 8).toUpperCase()}</span>
                  {b.agency_fee_collected_at ? (
                    <Badge variant="green">Collected</Badge>
                  ) : (
                    <Badge variant="yellow">Due</Badge>
                  )}
                </div>
                <p className="font-semibold text-slate-900 text-sm">
                  {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {b.profiles?.full_name ?? "-"} · {new Date(b.completed_at).toLocaleDateString("en-LK")}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-sm">
                    <span className="text-slate-500 text-xs">Fee: </span>
                    <span className="text-blue-600 font-medium">{formatLKR(b.agency_fee_lkr)}</span>
                  </span>
                  <InvoiceCollectToggle
                    bookingId={b.id}
                    collected={Boolean(b.agency_fee_collected_at)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
