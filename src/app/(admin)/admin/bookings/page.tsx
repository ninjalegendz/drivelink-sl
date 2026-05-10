import { createClient } from "@/lib/supabase/server";
import { BadgeCheck, ShieldAlert, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import type { BookingStatus } from "@/types/database";

const statusVariant: Record<BookingStatus, "slate" | "yellow" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "yellow",
  confirmed:            "yellow",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "red",
};

const TABS: { label: string; value: string }[] = [
  { label: "All",           value: "" },
  { label: "Pending slip",  value: "payment_pending" },
  { label: "Active",        value: "active" },
  { label: "Completed",     value: "completed" },
  { label: "Declined",      value: "declined" },
  { label: "Disputed",      value: "disputed" },
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const { status: filterStatus } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select("id, status, start_date, end_date, total_days, subtotal_lkr, booking_fee_lkr, created_at, vehicles(make, model, year, city), profiles(full_name, phone, kyc_status, is_blacklisted, blacklist_reason, rating_avg, rating_count, reliability_pct), agencies(name, city)")
    .order("created_at", { ascending: false });

  if (filterStatus) query = query.eq("status", filterStatus as BookingStatus);

  const { data } = await query.limit(100);
  const bookings = (data ?? []) as unknown as {
    id: string;
    status: BookingStatus;
    start_date: string;
    end_date: string;
    total_days: number;
    subtotal_lkr: number;
    booking_fee_lkr: number;
    created_at: string;
    vehicles: { make: string; model: string; year: number; city: string } | null;
    profiles: {
      full_name: string;
      phone: string;
      kyc_status: string;
      is_blacklisted: boolean;
      blacklist_reason: string | null;
      rating_avg: number | null;
      rating_count: number;
      reliability_pct: number | null;
    } | null;
    agencies: { name: string; city: string } | null;
  }[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">All Bookings</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(({ label, value }) => (
          <a
            key={value}
            href={value ? `/admin/bookings?status=${value}` : "/admin/bookings"}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterStatus === value || (!filterStatus && !value)
                ? "bg-slate-700 text-white font-medium"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <p className="text-slate-400 text-sm mb-4">{bookings.length} bookings</p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-800">
              <th className="pb-3 pr-4 font-medium">Ref</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Vehicle</th>
              <th className="pb-3 pr-4 font-medium">Renter</th>
              <th className="pb-3 pr-4 font-medium">Agency</th>
              <th className="pb-3 pr-4 font-medium">Dates</th>
              <th className="pb-3 pr-4 font-medium">Rental</th>
              <th className="pb-3 font-medium">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {bookings.map((b) => {
              const isBlacklisted = b.profiles?.is_blacklisted ?? false;
              return (
                <tr
                  key={b.id}
                  className={`transition-colors ${isBlacklisted ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-slate-900/50"}`}
                >
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs text-slate-400">
                      {b.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1">
                      <Badge variant={statusVariant[b.status]}>
                        {BOOKING_STATUS_LABELS[b.status]}
                      </Badge>
                      {isBlacklisted && (
                        <span
                          className="inline-flex items-center gap-1 text-red-400 text-[10px] font-medium"
                          title={b.profiles?.blacklist_reason ?? "This renter is blocked in the system"}
                        >
                          <ShieldAlert size={11} /> Renter blocked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-white">
                    {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                    <span className="text-slate-500 text-xs ml-1">· {b.vehicles?.city}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <p className={isBlacklisted ? "text-red-300 line-through" : "text-white"}>{b.profiles?.full_name}</p>
                    </div>
                    <p className="text-slate-500 text-xs">{b.profiles?.phone}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {b.profiles?.kyc_status === "verified" && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]"><BadgeCheck size={11} /> ID</span>
                      )}
                      {(b.profiles?.rating_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-400 text-[11px]">
                          <Star size={10} fill="currentColor" />
                          {b.profiles?.rating_avg?.toFixed(1)}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium ${reliabilityColor(b.profiles?.reliability_pct ?? null)}`}>
                        {reliabilityLabel(b.profiles?.reliability_pct ?? null)}
                      </span>
                    </div>
                    {isBlacklisted && b.profiles?.blacklist_reason && (
                      <p className="text-red-400/80 text-[11px] mt-0.5 max-w-xs">
                        Reason: {b.profiles.blacklist_reason}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{b.agencies?.name}</td>
                  <td className="py-3 pr-4 text-slate-300 text-xs whitespace-nowrap">
                    {b.start_date} → {b.end_date}
                    <br />
                    <span className="text-slate-500">{b.total_days}d</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{formatLKR(b.subtotal_lkr)}</td>
                  <td className="py-3 text-amber-400 font-medium">{formatLKR(b.booking_fee_lkr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {bookings.length === 0 && (
          <div className="text-center py-16 text-slate-500">No bookings found.</div>
        )}
      </div>
    </div>
  );
}
