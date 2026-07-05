import Link from "next/link";
import { BarChart3, TrendingUp, Wallet, Users, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/analytics/Sparkline";
import { formatLKR } from "@/lib/vehicles/format";
import {
  bookingCountsByStatus,
  dailyBookingTrend,
  revenueTotals,
  conversionFunnel,
  rangeForKey,
} from "@/lib/analytics/queries";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

const RANGE_TABS: { key: "7d" | "30d" | "90d" | "ytd"; label: string }[] = [
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "Year to date" },
];

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const rangeKey = (RANGE_TABS.find((t) => t.key === rangeParam)?.key ?? "30d");
  const range = rangeForKey(rangeKey);
  const supabase = await createClient();

  // Run queries in parallel
  const [byStatus, trend, money, funnel, userCounts, agencyCounts, vehicleCounts] = await Promise.all([
    bookingCountsByStatus(supabase, range),
    dailyBookingTrend(supabase, range),
    revenueTotals(supabase, range),
    conversionFunnel(supabase, range),
    supabase.from("profiles").select("role", { count: "exact", head: true }).eq("role", "renter").is("deleted_at", null),
    supabase.from("agencies").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
  ]);

  const trendValues = trend.map((d) => d.count);
  const totalRequests = funnel.requested;
  const confRate = totalRequests > 0 ? Math.round((funnel.confirmed / totalRequests) * 100) : 0;
  const paidRate = funnel.confirmed > 0 ? Math.round((funnel.paid     / funnel.confirmed) * 100) : 0;
  const compRate = funnel.paid > 0      ? Math.round((funnel.completed / funnel.paid)     * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Platform analytics</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">
        Live numbers across renters, agencies, and bookings.
      </p>

      {/* Range tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 w-fit flex-wrap">
        {RANGE_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/analytics?range=${t.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              rangeKey === t.key ? "bg-slate-200 text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Top-line counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Active renters"      value={userCounts.count    ?? 0} Icon={Users} />
        <Stat label="Active agencies"     value={agencyCounts.count  ?? 0} Icon={Building2} />
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
          <FunnelRow label={`Confirmed (${confRate}%)`} value={funnel.confirmed} max={funnel.requested} />
          <FunnelRow label={`Paid (${paidRate}%)`}      value={funnel.paid}      max={funnel.requested} />
          <FunnelRow label={`Completed (${compRate}%)`} value={funnel.completed} max={funnel.requested} />
        </div>
      </Card>

      {/* Money */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Card title="Platform revenue (completed bookings only)" Icon={Wallet}>
          <div className="space-y-2 text-sm">
            <Row label="Rs. 500 lock-in fees received"    value={formatLKR(money.lock_in_fees)}   />
            <Row label="Rs. 200 agency fees billed"       value={formatLKR(money.platform_fees)}   />
            <Row label="Collected" tone="emerald" value={formatLKR(money.collected_fees)} />
            <Row label="Outstanding" tone="amber"  value={formatLKR(money.outstanding_fees)} />
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-slate-900 font-semibold">
              <span>Total received</span>
              <span>{formatLKR(money.lock_in_fees + money.collected_fees)}</span>
            </div>
          </div>
        </Card>

        <Card title="Agency-side rental revenue (GMV)" Icon={Wallet}>
          <p className="text-3xl font-bold text-slate-900">{formatLKR(money.rental_revenue)}</p>
          <p className="text-slate-500 text-xs mt-1">
            Total agency-side revenue from {money.completed} completed bookings, what flowed through us, not to us
          </p>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card title="Bookings by status" subtitle="Created in range, regardless of current status">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["pending_confirmation", "confirmed", "payment_pending", "active", "completed", "declined", "cancelled", "disputed"] as const).map((s) => (
            <div key={s} className="bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">{s.replace(/_/g, " ")}</p>
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-3">
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
  const colorClass = tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-blue-600" : "text-slate-700";
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
