import { BarChart3, TrendingUp, Wallet, Users, Building2 } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/analytics/Sparkline";
import { TrafficAnalyticsPanel } from "@/components/admin/TrafficAnalyticsPanel";
import { formatLKR } from "@/lib/vehicles/format";
import { EMPTY_TRAFFIC_SNAPSHOT, trafficRangeStart, type TrafficRangeKey, type TrafficSnapshot } from "@/lib/analytics/traffic";
import {
  bookingCountsByStatus,
  dailyBookingTrend,
  revenueTotals,
  conversionFunnel,
  rangeForKey,
} from "@/lib/analytics/queries";
import { RangeTabs } from "@/components/analytics/RangeTabs";

// Always re-query: these numbers are the reason someone opened the page.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

const RANGE_TABS: { key: TrafficRangeKey; label: string }[] = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const rangeKey = (RANGE_TABS.find((t) => t.key === rangeParam)?.key ?? "30d");
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

  const trendValues = trend.map((d) => d.count);
  const totalRequests = funnel.requested;
  const reserveRate = totalRequests > 0 ? Math.round((funnel.reserved / totalRequests) * 100) : 0;
  const startRate   = funnel.reserved > 0 ? Math.round((funnel.started / funnel.reserved) * 100) : 0;
  const compRate    = funnel.started > 0 ? Math.round((funnel.completed / funnel.started) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Platform analytics</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">
        Live and historical traffic, customer journeys, bookings, and marketplace health.
      </p>

      {/* Range tabs: switching one re-queries immediately. */}
      <RangeTabs tabs={RANGE_TABS} active={rangeKey} basePath="/admin/analytics" />

      <TrafficAnalyticsPanel initial={traffic} range={rangeKey} />

      {/* Top-line counts */}
      <h2 className="mb-3 text-lg font-semibold text-slate-950">Marketplace and booking activity</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Active renters"      value={userCounts.count    ?? 0} Icon={Users} />
        <Stat label="Active Rental Pages" value={agencyCounts.count  ?? 0} Icon={Building2} />
        <Stat label="Live vehicle listings" value={vehicleCounts.count ?? 0} Icon={Building2} />
        <Stat label="Bookings in range"   value={trendValues.reduce((s, v) => s + v, 0)} Icon={TrendingUp} />
      </div>

      {/* Booking trend */}
      <Card title="Daily booking trend" subtitle={`${trend.length} days`}>
        <Sparkline values={trendValues} width={800} height={80} className="w-full h-20" />
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>{trend[0]?.date}</span>
          <span>{trend[trend.length - 1]?.date}</span>
        </div>
      </Card>

      {/* Conversion funnel */}
      <Card title="Conversion funnel" subtitle="From request to completed booking">
        <div className="space-y-2">
          <FunnelRow label="Requested"  value={funnel.requested} max={funnel.requested} />
          <FunnelRow label={`Reserved (${reserveRate}%)`} value={funnel.reserved} max={funnel.requested} />
          <FunnelRow label={`Started (${startRate}%)`}    value={funnel.started}  max={funnel.requested} />
          <FunnelRow label={`Completed (${compRate}%)`} value={funnel.completed} max={funnel.requested} />
        </div>
      </Card>

      {/* Money */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Card title="DriveLink booking confirmation fees" Icon={Wallet}>
          <div className="space-y-2 text-sm">
            <Row label="Fee recorded on completed bookings" value={formatLKR(money.confirmation_fees)} />
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-slate-900 font-semibold">
              <span>Current launch fee</span>
              <span>Rs. 0</span>
            </div>
            <p className="text-slate-500 text-xs pt-1">Rental and deposit payments are recorded as direct payments to providers.</p>
          </div>
        </Card>

        <Card title="Rental Page revenue (GMV)" Icon={Wallet}>
          <p className="text-3xl font-bold text-slate-900">{formatLKR(money.rental_revenue)}</p>
          <p className="text-slate-500 text-xs mt-1">
            Total rental value from {money.completed} completed bookings. This is paid directly to providers, not through DriveLink.
          </p>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card title="Bookings by status" subtitle="Created in range, regardless of current status">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["pending_confirmation", "confirmed", "active", "completed", "declined", "cancelled", "disputed"] as const).map((s) => (
            <div key={s} className="bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-xs uppercase tracking-wider">{s.replace(/_/g, " ")}</p>
              <p className="text-slate-900 text-lg font-semibold mt-0.5">{byStatus[s] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: number; Icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
        <Icon size={14} className="text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString("en-LK")}</p>
    </div>
  );
}

function Card({ title, subtitle, children, Icon }: { title: string; subtitle?: string; children: React.ReactNode; Icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 mb-3">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-blue-600" />}
        <h2 className="text-slate-900 font-semibold">{title}</h2>
        {subtitle && <span className="text-slate-500 text-xs">· {subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const colorClass = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-blue-600" : "text-slate-700";
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={colorClass}>{value}</span>
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-900 font-mono">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
