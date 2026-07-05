"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Car, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import { createClient } from "@/lib/supabase/client";
import type { BookingStatus } from "@/types/database";
import { RENTER_BOOKINGS_SELECT, type RenterBookingRow } from "./renter-bookings-query";

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

interface Props {
  initial:  RenterBookingRow[];
  renterId: string;
}

export function RenterBookingsList({ initial, renterId }: Props) {
  const poll = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bookings")
      .select(RENTER_BOOKINGS_SELECT)
      .eq("renter_id", renterId)
      .order("created_at", { ascending: false });
    return (data ?? null) as RenterBookingRow[] | null;
  }, [renterId]);

  const bookings = usePolledRows<RenterBookingRow>(initial, poll);

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-400" />
        <p className="font-medium text-slate-900 mb-1">No bookings yet</p>
        <p className="text-sm">Browse available vehicles and make your first booking.</p>
        <Link
          href="/vehicles"
          className="mt-4 inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Browse vehicles
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-slate-600 text-sm mb-6 -mt-2 flex items-center justify-between">
        <span>{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</span>
        <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 text-sm">
          Browse vehicles <ArrowRight size={14} />
        </Link>
      </p>
      <div className="space-y-3">
        {bookings.map((b) => (
          <Link
            key={b.id}
            href={`/bookings/${b.id}`}
            className="block spring-hover bg-white border border-slate-200 shadow-sm hover:border-blue-300 rounded-2xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-slate-900 font-semibold">
                    {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                  </p>
                  <Badge variant={statusVariant[b.status]}>
                    {BOOKING_STATUS_LABELS[b.status]}
                  </Badge>
                </div>
                <p className="text-slate-600 text-sm">{b.agencies?.name} · {b.vehicles?.city}</p>
                <p className="text-slate-500 text-xs mt-1">
                  {b.start_date} {b.start_time?.slice(0, 5)} → {b.end_date} {b.end_time?.slice(0, 5)} · {b.total_days} day{b.total_days !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-900 text-sm font-medium">{formatLKR(b.subtotal_lkr)}</p>
                {b.booking_fee_lkr > 0 && (
                  <p className="text-blue-600 text-xs">+{formatLKR(b.booking_fee_lkr)} fee</p>
                )}
                <p className="text-slate-400 text-xs mt-1 font-mono">{b.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
