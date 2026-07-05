"use client";

import { useCallback, useState } from "react";
import { Star, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import { createClient } from "@/lib/supabase/client";
import type { BookingStatus } from "@/types/database";
import { AGENCY_BOOKINGS_SELECT, type AgencyBookingRow } from "./agency-bookings-query";

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
  initial:             AgencyBookingRow[];
  agencyId:            string;
  filterStatus:        BookingStatus | "";
  /** Booking ids this agency has already reviewed the renter for. */
  reviewedBookingIds?: string[];
}

export function AgencyBookingsList({ initial, agencyId, filterStatus, reviewedBookingIds = [] }: Props) {
  const poll = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("bookings")
      .select(AGENCY_BOOKINGS_SELECT)
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (filterStatus) query = query.eq("status", filterStatus);
    const { data } = await query.limit(50);
    return (data ?? null) as AgencyBookingRow[] | null;
  }, [agencyId, filterStatus]);

  const bookings = usePolledRows<AgencyBookingRow>(initial, poll);

  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [justReviewed, setJustReviewed] = useState<Set<string>>(new Set());
  const isReviewed = (id: string) => reviewedBookingIds.includes(id) || justReviewed.has(id);

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
                : "bg-white border-slate-100"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">
                    {vehicle?.year} {vehicle?.make} {vehicle?.model}
                  </p>
                  <Badge variant={statusVariant[status]}>
                    {BOOKING_STATUS_LABELS[status]}
                  </Badge>
                </div>

                <p className="text-slate-600 text-sm mt-1">
                  {booking.start_date} {booking.start_time?.slice(0, 5)} → {booking.end_date} {booking.end_time?.slice(0, 5)} ({booking.total_days} days)
                </p>

                {renter && (
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p className={`text-sm ${blocked ? "text-red-300" : "text-slate-700"}`}>
                      {renter.full_name}
                    </p>
                    {blocked && <Badge variant="red">Flagged renter</Badge>}
                    {renter.kyc_status === "verified" && (
                      <Badge variant="green">ID Verified</Badge>
                    )}
                    {(renter.rating_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
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

                {/* Two-way reviews: rate the renter after a completed trip */}
                {status === "completed" && renter && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {isReviewed(booking.id) ? (
                      <p className="text-xs text-emerald-600 inline-flex items-center gap-1">
                        <Star size={12} fill="currentColor" /> You rated this renter
                      </p>
                    ) : openReviewId === booking.id ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Rate {renter.full_name}</p>
                        <ReviewForm
                          bookingId={booking.id}
                          revieweeId={booking.renter_id}
                          subjectName={renter.full_name}
                          onSubmitted={() => {
                            setJustReviewed((s) => new Set(s).add(booking.id));
                            setOpenReviewId(null);
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenReviewId(booking.id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Rate this renter →
                      </button>
                    )}
                  </div>
                )}
              </div>

              <AgencyBookingActions bookingId={booking.id} status={status} renterReturnedAt={booking.renter_returned_at} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
