import { createServiceClient } from "@/lib/supabase/server";
import { AdminAnalyticsView, RANGE_TABS } from "@/components/admin/ops/AdminAnalyticsView";
import { EMPTY_TRAFFIC_SNAPSHOT, trafficRangeStart, type TrafficRangeKey, type TrafficSnapshot } from "@/lib/analytics/traffic";
import {
  bookingCountsByStatus,
  dailyBookingTrend,
  revenueTotals,
  conversionFunnel,
  rangeForKey,
} from "@/lib/analytics/queries";

// Always re-query: these numbers are the reason someone opened the page.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const rangeKey = (RANGE_TABS.find((t) => t.key === rangeParam)?.key ?? "30d") as TrafficRangeKey;
  const range = rangeKey === "24h"
    ? { startIso: trafficRangeStart("24h"), endIso: new Date().toISOString() }
    : rangeForKey(rangeKey);
  // Service client: these admin dashboards read protected profile columns
  // (phone, email, KYC docs, blacklist state) that browser sessions can no
  // longer SELECT. The (admin) layout enforces the admin role upstream.
  const supabase = await createServiceClient();

  // Run queries in parallel
  const [byStatus, trend, money, funnel, userCounts, agencyCounts, vehicleCounts, trafficResult] = await Promise.all([
    bookingCountsByStatus(supabase, range),
    dailyBookingTrend(supabase, range),
    revenueTotals(supabase, range),
    conversionFunnel(supabase, range),
    supabase.from("profiles").select("role", { count: "exact", head: true }).eq("role", "renter").is("deleted_at", null),
    supabase.from("agencies").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
    supabase.rpc("traffic_analytics_snapshot", { p_since: trafficRangeStart(rangeKey) }),
  ]);
  const traffic = (trafficResult.data ?? EMPTY_TRAFFIC_SNAPSHOT) as TrafficSnapshot;

  return (
    <AdminAnalyticsView
      rangeKey={rangeKey}
      traffic={traffic}
      byStatus={byStatus}
      trend={trend}
      money={money}
      funnel={funnel}
      renterCount={userCounts.count ?? 0}
      agencyCount={agencyCounts.count ?? 0}
      liveVehicleCount={vehicleCounts.count ?? 0}
    />
  );
}
