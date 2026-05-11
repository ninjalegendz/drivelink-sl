import { redirect } from "next/navigation";
import Link from "next/link";
import { Car, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
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

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/bookings");

  const { data } = await supabase
    .from("bookings")
    .select("id, status, start_date, end_date, total_days, subtotal_lkr, booking_fee_lkr, created_at, vehicles(make, model, year, city), agencies(name)")
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

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
    agencies: { name: string } | null;
  }[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bookings</h1>
          <p className="text-slate-400 text-sm mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm">
          Browse vehicles <ArrowRight size={14} />
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-600" />
          <p className="font-medium text-white mb-1">No bookings yet</p>
          <p className="text-sm">Browse available vehicles and make your first booking.</p>
          <Link
            href="/vehicles"
            className="mt-4 inline-block px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors"
          >
            Browse vehicles
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="block bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-white font-semibold">
                      {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                    </p>
                    <Badge variant={statusVariant[b.status]}>
                      {BOOKING_STATUS_LABELS[b.status]}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-sm">{b.agencies?.name} · {b.vehicles?.city}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {b.start_date} → {b.end_date} · {b.total_days} day{b.total_days !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-medium">{formatLKR(b.subtotal_lkr)}</p>
                  <p className="text-amber-400 text-xs">+{formatLKR(b.booking_fee_lkr)} fee</p>
                  <p className="text-slate-600 text-xs mt-1 font-mono">{b.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
