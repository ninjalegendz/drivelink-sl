"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { createClient, realtimeReady } from "@/lib/supabase/client";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";

interface InitialStats {
  reliabilityPct: number | null;
  pendingCount:   number;
  activeCount:    number;
  vehicleCount:   number;
  feesOwed:       number;
}

interface Props {
  agencyId: string;
  initial:  InitialStats;
}

/**
 * Live versions of the agency dashboard stat cards + fees-owed panel.
 *
 * Subscribes to public.bookings changes for this agency and re-queries the
 * three booking-derived numbers (pending count, active count, fees owed)
 * on any event. Reliability and fleet size don't change on booking events,
 * so they're held static from the initial server fetch.
 *
 * Re-fetching all three is one count query + one count query + one rows
 * query — cheap, simpler than computing deltas, and bulletproof against
 * status-transition edge cases.
 */
export function DashboardStatsLive({ agencyId, initial }: Props) {
  const [pendingCount, setPendingCount] = useState(initial.pendingCount);
  const [activeCount,  setActiveCount]  = useState(initial.activeCount);
  const [feesOwed,     setFeesOwed]     = useState(initial.feesOwed);
  const inflightRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refresh() {
      // Coalesce: if a refresh is already in flight, skip — the in-flight
      // query will reflect the latest state when it completes.
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const [pendingRes, activeRes, feeRowsRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", agencyId)
            .eq("status", "pending_confirmation"),
          supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", agencyId)
            .eq("status", "active"),
          supabase
            .from("bookings")
            .select("agency_fee_lkr")
            .eq("agency_id", agencyId)
            .eq("status", "completed")
            .is("agency_fee_collected_at", null),
        ]);
        if (cancelled) return;
        setPendingCount(pendingRes.count ?? 0);
        setActiveCount(activeRes.count ?? 0);
        const fees = ((feeRowsRes.data ?? []) as { agency_fee_lkr: number }[])
          .reduce((s, r) => s + r.agency_fee_lkr, 0);
        setFeesOwed(fees);
      } finally {
        inflightRef.current = false;
      }
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    void realtimeReady().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`dashboard-stats-${agencyId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings", filter: `agency_id=eq.${agencyId}` },
          () => { void refresh(); },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "bookings", filter: `agency_id=eq.${agencyId}` },
          () => { void refresh(); },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "bookings", filter: `agency_id=eq.${agencyId}` },
          () => { void refresh(); },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [agencyId]);

  const cards = [
    {
      label: "Reliability Score",
      value: reliabilityLabel(initial.reliabilityPct),
      color: reliabilityColor(initial.reliabilityPct),
      href:  "#",
    },
    {
      label: "Pending requests",
      value: pendingCount,
      color: "text-amber-400",
      href:  "/dashboard/bookings?status=pending_confirmation",
    },
    {
      label: "Active bookings",
      value: activeCount,
      color: "text-emerald-400",
      href:  "/dashboard/bookings?status=active",
    },
    {
      label: "Fleet size",
      value: initial.vehicleCount,
      color: "text-white",
      href:  "/dashboard/vehicles",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, color, href }) => (
          <Link
            key={label}
            href={href}
            className="spring-hover bg-slate-900 border border-slate-200 shadow-sm hover:border-amber-300 rounded-2xl p-4 transition-colors block"
          >
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-400 text-sm mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {feesOwed > 0 && (
        <div className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-200 rounded-2xl shadow-sm mb-6">
          <Receipt size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-white font-medium text-sm">
              Platform fees: <span className="text-amber-400">{formatLKR(feesOwed)}</span>
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              Rs. 200 per completed booking. We&apos;ll invoice you monthly; transfer to the DriveLink
              account once you get the bill.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
