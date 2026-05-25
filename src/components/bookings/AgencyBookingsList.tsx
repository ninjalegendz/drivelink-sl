"use client";

import { Star, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { useBookingsRealtime } from "@/lib/realtime/useBookingsRealtime";
import type { BookingStatus } from "@/types/database";

export interface AgencyBookingRow {
  id:           string;
  status:       BookingStatus;
  start_date:   string;
  end_date:     string;
  total_days:   number;
  subtotal_lkr: number;
  created_at:   string;
  vehicles: { make: string; model: string; year: number } | null;
  profiles: {
    full_name:               string;
    rating_avg:              number | null;
    rating_count:            number;
    reliability_pct:         number | null;
    kyc_status:              string;
    is_blacklisted:          boolean;
    blacklist_reason_public: string | null;
  } | null;
}

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

export const AGENCY_BOOKINGS_SELECT =
  "id, status, start_date, end_date, total_days, subtotal_lkr, created_at, " +
  "vehicles(make, model, year), " +
  "profiles(full_name, rating_avg, rating_count, reliability_pct, kyc_status, is_blacklisted, blacklist_reason_public)";

interface Props {
  initial:      AgencyBookingRow[];
  agencyId:     string;
  filterStatus: BookingStatus | "";
}

export function AgencyBookingsList({ initial, agencyId, filterStatus }: Props) {
  const bookings = useBookingsRealtime<AgencyBookingRow>(initial, {
    channelName: `agency-bookings-${agencyId}-${filterStatus || "all"}`,
    filter:      `agency_id=eq.${agencyId}`,
    selectQuery: AGENCY_BOOKINGS_SELECT,
    inScope:     filterStatus ? (row) => row.status === filterStatus : undefined,
  });

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>No bookings {filterStatus ? `with status "${filterStatus}"` : "yet"}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const vehicle = booking.vehicles;
        const renter  = booking.profiles;
        const status  = booking.status;
        const blocked = renter?.is_blacklisted ?? false;

        return (
          <div
            key={booking.id}
            className={`rounded-2xl p-4 border ${
              blocked
                ? "bg-red-500/5 border-red-500/30"
                : "bg-slate-900 border-slate-800"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white">
                    {vehicle?.year} {vehicle?.make} {vehicle?.model}
                  </p>
                  <Badge variant={statusVariant[status]}>
                    {BOOKING_STATUS_LABELS[status]}
                  </Badge>
                </div>

                <p className="text-slate-400 text-sm mt-1">
                  {booking.start_date} → {booking.end_date} ({booking.total_days} days)
                </p>

                {renter && (
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p className={`text-sm ${blocked ? "text-red-300" : "text-slate-300"}`}>
                      {renter.full_name}
                    </p>
                    {blocked && <Badge variant="red">Flagged renter</Badge>}
                    {renter.kyc_status === "verified" && (
                      <Badge variant="green">ID Verified</Badge>
                    )}
                    {(renter.rating_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                        <Star size={11} fill="currentColor" className="text-amber-400" />
                        {renter.rating_avg?.toFixed(1)}
                      </span>
                    )}
                    <span className={`text-xs font-medium ${reliabilityColor(renter.reliability_pct)}`}>
                      {reliabilityLabel(renter.reliability_pct)} reliable
                    </span>
                  </div>
                )}

                {blocked && (
                  <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-sm">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium text-xs">
                        DriveLink has flagged this renter
                      </p>
                      <p className="text-red-300/80 text-xs mt-0.5">
                        {renter?.blacklist_reason_public
                          ? renter.blacklist_reason_public
                          : "No public reason provided. Contact DriveLink support before accepting."}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-1">
                        You may decline this request without penalty.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-slate-500 text-xs mt-2">
                  Rental: {formatLKR(booking.subtotal_lkr)}
                </p>
              </div>

              <AgencyBookingActions bookingId={booking.id} status={status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
