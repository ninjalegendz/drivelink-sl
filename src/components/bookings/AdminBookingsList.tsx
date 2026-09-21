"use client";

import { Fragment, useCallback, useState } from "react";
import { BadgeCheck, ShieldAlert, ChevronDown, ChevronUp, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { AdminBookingActions } from "@/components/admin/AdminBookingActions";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import { createClient } from "@/lib/supabase/client";
import type { BookingStatus } from "@/types/database";
import { ADMIN_BOOKINGS_SELECT, type AdminBookingRow } from "./admin-bookings-query";

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
  initial:      AdminBookingRow[];
  filterStatus: BookingStatus | "";
}

export function AdminBookingsList({ initial, filterStatus }: Props) {
  const poll = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("bookings")
      .select(ADMIN_BOOKINGS_SELECT)
      .order("created_at", { ascending: false });
    if (filterStatus) query = query.eq("status", filterStatus);
    const { data } = await query.limit(100);
    return (data ?? null) as AdminBookingRow[] | null;
  }, [filterStatus]);

  const bookings = usePolledRows<AdminBookingRow>(initial, poll);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <>
      <p className="text-slate-600 text-sm mb-4">{bookings.length} bookings</p>

      {/* Desktop: dense table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="pb-3 pr-4 font-medium">Ref</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Vehicle</th>
              <th className="pb-3 pr-4 font-medium">Renter</th>
              <th className="pb-3 pr-4 font-medium">Agency</th>
              <th className="pb-3 pr-4 font-medium">Dates</th>
              <th className="pb-3 pr-4 font-medium">Rental</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b) => {
              const isBlacklisted = b.profiles?.is_blacklisted ?? false;
              const incidentCount = b.incidents?.length ?? 0;
              const hasIncidents  = false;
              const reviewRaw = b.booking_overdue_reviews;
              const recoveryReview = Array.isArray(reviewRaw) ? reviewRaw[0] : reviewRaw;
              const hasRecovery = recoveryReview?.status === "pending" || !!b.overdue_critical_at;
              const isExpanded    = expanded.has(b.id);
              return (
                <Fragment key={b.id}>
                  <tr
                    className={`transition-colors ${isBlacklisted ? "bg-rose-50 hover:bg-rose-50" : "hover:bg-white/60"}`}
                  >
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-slate-600">
                        {b.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={statusVariant[b.status]}>
                          {BOOKING_STATUS_LABELS[b.status]}
                        </Badge>
                        {isBlacklisted && (
                          <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium">
                            <ShieldAlert size={11} /> Renter blocked
                          </span>
                        )}
                        {hasIncidents && (
                          <div className="flex flex-col items-start gap-1">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(b.id)}
                              className="inline-flex items-center gap-0.5 text-red-600 text-xs font-medium hover:text-red-700"
                            >
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              {isExpanded ? "Hide summary" : `View summary (${incidentCount})`}
                            </button>
                          </div>
                        )}
                        {hasRecovery && (
                          <button type="button" onClick={() => toggleExpanded(b.id)} className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold hover:text-amber-800">
                            <Clock3 size={11} /> {recoveryReview?.status === "pending" ? "Return review" : "Critical return"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-900">
                      {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                      <span className="text-slate-500 text-xs ml-1">· {b.vehicles?.city}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className={isBlacklisted ? "text-rose-700 line-through" : "text-slate-900"}>{b.profiles?.full_name}</p>
                      <p className="text-slate-500 text-xs">{b.profiles?.phone}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <RenterTrustPills p={b.profiles} />
                      </div>
                      {isBlacklisted && b.profiles?.blacklist_reason && (
                        <p className="text-rose-600/80 text-xs mt-0.5 max-w-xs">
                          Reason: {b.profiles.blacklist_reason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{b.agencies?.name}</td>
                    <td className="py-3 pr-4 text-slate-700 text-xs whitespace-nowrap">
                      {b.start_date} {b.start_time?.slice(0, 5)} → {b.end_date} {b.end_time?.slice(0, 5)}
                      <br />
                      <span className="text-slate-500">{b.total_days}d</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{formatLKR(b.subtotal_lkr)}</td>
                    <td className="py-3">
                      <AdminBookingActions bookingId={b.id} status={b.status} />
                    </td>
                  </tr>
                  {(hasIncidents || hasRecovery) && isExpanded && (
                    <tr>
                      <td colSpan={8} className="pb-4 pt-0">
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards (no sideways scrolling) */}
      <div className="md:hidden space-y-3">
        {bookings.map((b) => {
          const isBlacklisted = b.profiles?.is_blacklisted ?? false;
          const incidentCount = b.incidents?.length ?? 0;
          const hasIncidents  = false;
          const reviewRaw = b.booking_overdue_reviews;
          const recoveryReview = Array.isArray(reviewRaw) ? reviewRaw[0] : reviewRaw;
          const hasRecovery = recoveryReview?.status === "pending" || !!b.overdue_critical_at;
          const isExpanded    = expanded.has(b.id);
          return (
            <div
              key={b.id}
              className={`rounded-xl border p-3 ${isBlacklisted ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs text-slate-500">{b.id.slice(0, 8).toUpperCase()}</span>
                <Badge variant={statusVariant[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
              </div>

              {hasIncidents && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(b.id)}
                    className="inline-flex items-center gap-0.5 text-rose-700 text-xs font-medium hover:text-red-600"
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? "Hide report" : `View report (${incidentCount})`}
                  </button>
                </div>
              )}
              {hasRecovery && (
                <div className="mb-2">
                  <button type="button" onClick={() => toggleExpanded(b.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                    <Clock3 size={12} /> {recoveryReview?.status === "pending" ? "Review unreturned vehicle" : "Critical return record"}
                  </button>
                </div>
              )}

              <p className="font-semibold text-slate-900 text-sm">
                {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                <span className="text-slate-500 font-normal"> · {b.vehicles?.city}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {b.start_date} {b.start_time?.slice(0, 5)} → {b.end_date} {b.end_time?.slice(0, 5)} · {b.total_days}d
              </p>

              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <p className={`min-w-0 break-words text-sm ${isBlacklisted ? "text-rose-600 line-through" : "text-slate-900"}`}>{b.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500">{b.profiles?.phone}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <RenterTrustPills p={b.profiles} />
                </div>
                {isBlacklisted && (
                  <p className="text-rose-600/90 text-xs mt-1 inline-flex items-start gap-1">
                    <ShieldAlert size={11} className="mt-0.5 shrink-0" /> Blocked: {b.profiles?.blacklist_reason ?? "flagged in the system"}
                  </p>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                <span><span className="text-slate-500">Agency:</span> <span className="text-slate-700">{b.agencies?.name}</span></span>
                <span><span className="text-slate-500">Rental:</span> <span className="text-slate-700">{formatLKR(b.subtotal_lkr)}</span></span>
              </div>

              <div className="mt-2">
                <AdminBookingActions bookingId={b.id} status={b.status} />
              </div>
            </div>
          );
        })}
      </div>

      {bookings.length === 0 && (
        <div className="text-center py-16 text-slate-500">No bookings found.</div>
      )}
    </>
  );
}

// Shared renter trust signals (ID verification and reliability), used by both
// the desktop table row and the mobile card.
function RenterTrustPills({ p }: { p: AdminBookingRow["profiles"] }) {
  return (
    <>
      {p?.kyc_status === "verified" && (
        <span className="inline-flex items-center gap-1 text-emerald-500 text-xs"><BadgeCheck size={11} /> ID</span>
      )}
      <span className={`text-xs font-medium ${reliabilityColor(p?.reliability_pct ?? null)}`}>
        {reliabilityLabel(p?.reliability_pct ?? null)}
      </span>
    </>
  );
}

