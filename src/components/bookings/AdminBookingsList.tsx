"use client";

import { Fragment, useCallback, useState } from "react";
import { BadgeCheck, ShieldAlert, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { AdminBookingActions } from "@/components/admin/AdminBookingActions";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import { createClient } from "@/lib/supabase/client";
import { INCIDENT_TYPE_LABELS, INCIDENT_SIDE_LABELS, type IncidentType } from "@/lib/booking/incident-types";
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
              <th className="pb-3 pr-4 font-medium">Fee</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b) => {
              const isBlacklisted = b.profiles?.is_blacklisted ?? false;
              const incidentCount = b.incidents?.length ?? 0;
              const hasIncidents  = b.status === "disputed" && incidentCount > 0;
              const isExpanded    = expanded.has(b.id);
              return (
                <Fragment key={b.id}>
                  <tr
                    className={`transition-colors ${isBlacklisted ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-white/60"}`}
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
                          <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-medium">
                            <ShieldAlert size={11} /> Renter blocked
                          </span>
                        )}
                        {hasIncidents && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(b.id)}
                            className="inline-flex items-center gap-0.5 text-red-500 text-[10px] font-medium hover:text-red-600"
                          >
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            {isExpanded ? "Hide report" : `View report (${incidentCount})`}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-900">
                      {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                      <span className="text-slate-500 text-xs ml-1">· {b.vehicles?.city}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className={isBlacklisted ? "text-red-300 line-through" : "text-slate-900"}>{b.profiles?.full_name}</p>
                      <p className="text-slate-500 text-xs">{b.profiles?.phone}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <RenterTrustPills p={b.profiles} />
                      </div>
                      {isBlacklisted && b.profiles?.blacklist_reason && (
                        <p className="text-red-400/80 text-[11px] mt-0.5 max-w-xs">
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
                    <td className="py-3 pr-4 text-blue-600 font-medium">{formatLKR(b.booking_fee_lkr)}</td>
                    <td className="py-3">
                      <AdminBookingActions bookingId={b.id} status={b.status} />
                    </td>
                  </tr>
                  {hasIncidents && isExpanded && (
                    <tr>
                      <td colSpan={9} className="pb-4 pt-0">
                        <IncidentsBlock incidents={b.incidents} />
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
          const hasIncidents  = b.status === "disputed" && incidentCount > 0;
          const isExpanded    = expanded.has(b.id);
          return (
            <div
              key={b.id}
              className={`rounded-xl border p-3 ${isBlacklisted ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[11px] text-slate-500">{b.id.slice(0, 8).toUpperCase()}</span>
                <Badge variant={statusVariant[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
              </div>

              {hasIncidents && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(b.id)}
                    className="inline-flex items-center gap-0.5 text-red-500 text-[11px] font-medium hover:text-red-600"
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? "Hide report" : `View report (${incidentCount})`}
                  </button>
                  {isExpanded && <IncidentsBlock incidents={b.incidents} />}
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
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${isBlacklisted ? "text-red-400 line-through" : "text-slate-900"}`}>{b.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500">{b.profiles?.phone}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <RenterTrustPills p={b.profiles} />
                </div>
                {isBlacklisted && (
                  <p className="text-red-400/90 text-[11px] mt-1 inline-flex items-start gap-1">
                    <ShieldAlert size={11} className="mt-0.5 shrink-0" /> Blocked: {b.profiles?.blacklist_reason ?? "flagged in the system"}
                  </p>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                <span><span className="text-slate-500">Agency:</span> <span className="text-slate-700">{b.agencies?.name}</span></span>
                <span><span className="text-slate-500">Rental:</span> <span className="text-slate-700">{formatLKR(b.subtotal_lkr)}</span></span>
                <span><span className="text-slate-500">Fee:</span> <span className="text-blue-600 font-medium">{formatLKR(b.booking_fee_lkr)}</span></span>
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

// Shared renter trust signals (ID-verified, rating, reliability), used by both
// the desktop table row and the mobile card.
function RenterTrustPills({ p }: { p: AdminBookingRow["profiles"] }) {
  return (
    <>
      {p?.kyc_status === "verified" && (
        <span className="inline-flex items-center gap-1 text-emerald-500 text-[11px]"><BadgeCheck size={11} /> ID</span>
      )}
      {(p?.rating_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 text-blue-600 text-[11px]">
          <Star size={10} fill="currentColor" />
          {p?.rating_avg?.toFixed(1)}
        </span>
      )}
      <span className={`text-[11px] font-medium ${reliabilityColor(p?.reliability_pct ?? null)}`}>
        {reliabilityLabel(p?.reliability_pct ?? null)}
      </span>
    </>
  );
}

// Incident report(s) filed against a disputed booking, shown in an
// expandable block so admins can see what was reported before resolving.
function IncidentsBlock({ incidents }: { incidents: AdminBookingRow["incidents"] }) {
  if (!incidents || incidents.length === 0) return null;
  return (
    <div className="space-y-2">
      {incidents.map((inc) => (
        <div key={inc.id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">
              {INCIDENT_TYPE_LABELS[inc.type as IncidentType] ?? inc.type}
            </span>
            <span className="text-slate-500">
              Filed by {INCIDENT_SIDE_LABELS[inc.filed_by_side] ?? inc.filed_by_side}
              {" · "}
              {new Date(inc.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
          <p className="text-slate-700 mt-1.5 whitespace-pre-wrap">{inc.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {inc.amount_lkr != null && (
              <span className="text-slate-600">
                Amount: <span className="font-medium text-slate-900">{formatLKR(inc.amount_lkr)}</span>
              </span>
            )}
            {inc.status !== "open" && (
              <span className="text-slate-400 italic">Status: {inc.status}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
