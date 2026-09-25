"use client";

import { Fragment, useCallback, useState } from "react";
import { BadgeCheck, ShieldAlert, ChevronDown, ChevronUp, Clock3, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { formatDay } from "@/lib/dates/display";
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

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={22} className="text-slate-400" strokeWidth={1.5} />}
        title="No bookings found"
        description="Nothing matches this filter yet. New requests and rentals will appear here as they come in."
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-slate-500">{bookings.length} booking{bookings.length === 1 ? "" : "s"}</p>

      {/* Desktop: dense table */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.06] md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-left text-xs font-medium text-slate-500">
                <th className="py-3 pl-4 pr-4">Ref</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Vehicle</th>
                <th className="py-3 pr-4">Renter</th>
                <th className="py-3 pr-4">Rental Page</th>
                <th className="py-3 pr-4">Dates</th>
                <th className="py-3 pr-4 text-right">Total</th>
                <th className="py-3 pr-4">Actions</th>
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
                    <tr className={`transition-colors ${isBlacklisted ? "bg-rose-50/70 hover:bg-rose-50" : "hover:bg-slate-50/60"}`}>
                      <td className="py-3 pl-4 pr-4">
                        <span className="font-mono text-xs text-slate-500">{b.id.slice(0, 8).toUpperCase()}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={statusVariant[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                          {isBlacklisted && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                              <ShieldAlert size={11} aria-hidden="true" /> Renter blocked
                            </span>
                          )}
                          {hasIncidents && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(b.id)}
                              className="inline-flex min-h-6 items-center gap-0.5 text-xs font-medium text-rose-600 hover:text-rose-700"
                            >
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              {isExpanded ? "Hide summary" : `View summary (${incidentCount})`}
                            </button>
                          )}
                          {hasRecovery && (
                            <button type="button" onClick={() => toggleExpanded(b.id)} className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800">
                              <Clock3 size={11} /> {recoveryReview?.status === "pending" ? "Return review" : "Critical return"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-900">
                        {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                        <span className="ml-1 text-xs text-slate-500">&middot; {b.vehicles?.city}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className={isBlacklisted ? "text-rose-700 line-through" : "text-slate-900"}>{b.profiles?.full_name}</p>
                        <p className="text-xs text-slate-500">{b.profiles?.phone}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <RenterTrustPills p={b.profiles} />
                        </div>
                        {isBlacklisted && b.profiles?.blacklist_reason && (
                          <p className="mt-0.5 max-w-xs text-xs text-rose-600/80">Reason: {b.profiles.blacklist_reason}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{b.agencies?.name}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-xs text-slate-600">
                        {formatDay(b.start_date)} {b.start_time?.slice(0, 5)}
                        <span aria-hidden="true" className="text-slate-400"> &rarr; </span>
                        {formatDay(b.end_date)} {b.end_time?.slice(0, 5)}
                        <br />
                        <span className="text-slate-400">{b.total_days}d</span>
                      </td>
                      <td className="tabular py-3 pr-4 text-right font-semibold text-slate-900">{formatLKR(b.subtotal_lkr)}</td>
                      <td className="py-3 pr-4">
                        <AdminBookingActions bookingId={b.id} status={b.status} />
                      </td>
                    </tr>
                    {(hasIncidents || hasRecovery) && isExpanded && (
                      <tr>
                        <td colSpan={8} className="pb-4 pt-0" />
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked cards (no sideways scrolling) */}
      <div className="space-y-3 md:hidden">
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
              className={`rounded-2xl p-4 shadow-xs ring-1 ${isBlacklisted ? "bg-rose-50/60 ring-rose-200" : "bg-white ring-slate-900/[0.06]"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{b.id.slice(0, 8).toUpperCase()}</span>
                <Badge variant={statusVariant[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
              </div>

              {hasIncidents && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(b.id)}
                  className="mb-2 inline-flex min-h-8 items-center gap-0.5 text-xs font-medium text-rose-700 hover:text-rose-600"
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {isExpanded ? "Hide report" : `View report (${incidentCount})`}
                </button>
              )}
              {hasRecovery && (
                <button type="button" onClick={() => toggleExpanded(b.id)} className="mb-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-amber-800">
                  <Clock3 size={12} /> {recoveryReview?.status === "pending" ? "Review unreturned vehicle" : "Critical return record"}
                </button>
              )}

              <p className="text-sm font-semibold text-slate-900">
                {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                <span className="font-normal text-slate-500"> &middot; {b.vehicles?.city}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDay(b.start_date)} {b.start_time?.slice(0, 5)}
                <span aria-hidden="true"> &rarr; </span>
                {formatDay(b.end_date)} {b.end_time?.slice(0, 5)} &middot; {b.total_days}d
              </p>

              <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <p className={`min-w-0 break-words text-sm ${isBlacklisted ? "text-rose-600 line-through" : "text-slate-900"}`}>{b.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500">{b.profiles?.phone}</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RenterTrustPills p={b.profiles} />
                </div>
                {isBlacklisted && (
                  <p className="mt-1 inline-flex items-start gap-1 text-xs text-rose-600/90">
                    <ShieldAlert size={11} className="mt-0.5 shrink-0" /> Blocked: {b.profiles?.blacklist_reason ?? "flagged in the system"}
                  </p>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-slate-100 pt-2.5 text-xs">
                <span><span className="text-slate-500">Rental Page:</span> <span className="text-slate-700">{b.agencies?.name}</span></span>
                <span><span className="text-slate-500">Total:</span> <span className="tabular font-semibold text-slate-900">{formatLKR(b.subtotal_lkr)}</span></span>
              </div>

              <div className="mt-2.5">
                <AdminBookingActions bookingId={b.id} status={b.status} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Shared renter trust signals (ID verification and reliability), used by both
// the desktop table row and the mobile card.
function RenterTrustPills({ p }: { p: AdminBookingRow["profiles"] }) {
  return (
    <>
      {p?.kyc_status === "verified" && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><BadgeCheck size={11} /> ID</span>
      )}
      <span className={`text-xs font-medium ${reliabilityColor(p?.reliability_pct ?? null)}`}>
        {reliabilityLabel(p?.reliability_pct ?? null)}
      </span>
    </>
  );
}
