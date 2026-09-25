import { BarChart3, TrendingUp, Wallet, Users, Building2, Car } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Sparkline } from "@/components/analytics/Sparkline";
import { RangeTabs } from "@/components/analytics/RangeTabs";
import { TrafficAnalyticsPanel } from "@/components/admin/TrafficAnalyticsPanel";
import { formatLKR } from "@/lib/vehicles/format";
import type { TrafficRangeKey, TrafficSnapshot } from "@/lib/analytics/traffic";

export const RANGE_TABS: { key: TrafficRangeKey; label: string }[] = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

const BOOKING_STATUS_ORDER = ["pending_confirmation", "confirmed", "active", "completed", "declined", "cancelled", "disputed"] as const;

export interface AdminAnalyticsViewProps {
  rangeKey: TrafficRangeKey;
  traffic: TrafficSnapshot;
  byStatus: Record<string, number>;
  trend: { date: string; count: number }[];
  money: { completed: number; rental_revenue: number; confirmation_fees: number };
  funnel: { requested: number; reserved: number; started: number; completed: number };
  renterCount: number;
  agencyCount: number;
  liveVehicleCount: number;
}

export function AdminAnalyticsView({
  rangeKey, traffic, byStatus, trend, money, funnel, renterCount, agencyCount, liveVehicleCount,
}: AdminAnalyticsViewProps) {
  const trendValues = trend.map((d) => d.count);
  const bookingsInRange = trendValues.reduce((s, v) => s + v, 0);
  const reserveRate = funnel.requested > 0 ? Math.round((funnel.reserved / funnel.requested) * 100) : 0;
  const startRate   = funnel.reserved > 0 ? Math.round((funnel.started / funnel.reserved) * 100) : 0;
  const compRate    = funnel.started > 0 ? Math.round((funnel.completed / funnel.started) * 100) : 0;

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        title="Platform analytics"
        description="Live and historical traffic, customer journeys, bookings, and marketplace health."
      />

      <RangeTabs tabs={RANGE_TABS} active={rangeKey} basePath="/admin/analytics" />

      <TrafficAnalyticsPanel initial={traffic} range={rangeKey} />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">Marketplace and booking activity</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Active renters" value={renterCount.toLocaleString("en-LK")} icon={<Users size={14} aria-hidden="true" />} />
          <Stat label="Active Rental Pages" value={agencyCount.toLocaleString("en-LK")} icon={<Building2 size={14} aria-hidden="true" />} />
          <Stat label="Live vehicle listings" value={liveVehicleCount.toLocaleString("en-LK")} icon={<Car size={14} aria-hidden="true" />} />
          <Stat label="Bookings in range" value={bookingsInRange.toLocaleString("en-LK")} icon={<TrendingUp size={14} aria-hidden="true" />} />
        </div>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">Daily booking trend</h2>
          <span className="text-xs text-slate-500">&middot; {trend.length} days</span>
        </div>
        <Sparkline values={trendValues} width={800} height={80} className="h-20 w-full" />
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>{trend[0]?.date}</span>
          <span>{trend[trend.length - 1]?.date}</span>
        </div>
      </Card>

      <Card padding="lg">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Conversion funnel</h2>
          <p className="text-xs text-slate-500">From request to completed booking</p>
        </div>
        <div className="space-y-3">
          <FunnelRow label="Requested" value={funnel.requested} max={funnel.requested} />
          <FunnelRow label={`Reserved (${reserveRate}%)`} value={funnel.reserved} max={funnel.requested} />
          <FunnelRow label={`Started (${startRate}%)`} value={funnel.started} max={funnel.requested} />
          <FunnelRow label={`Completed (${compRate}%)`} value={funnel.completed} max={funnel.requested} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">DriveLink booking confirmation fees</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Fee recorded on completed bookings</span>
              <span className="tabular text-slate-900">{formatLKR(money.confirmation_fees)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <span>Current launch fee</span>
              <span className="tabular">Rs. 0</span>
            </div>
            <p className="pt-1 text-xs text-slate-500">Rental and deposit payments are recorded as direct payments to providers.</p>
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Rental Page revenue (GMV)</h2>
          </div>
          <p className="tabular text-3xl font-semibold tracking-tight text-slate-950">{formatLKR(money.rental_revenue)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Total rental value from {money.completed} completed bookings. This is paid directly to providers, not through DriveLink.
          </p>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Bookings by status</h2>
          <p className="text-xs text-slate-500">Created in range, regardless of current status</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOOKING_STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl bg-slate-50 px-3.5 py-3">
              <p className="text-xs text-slate-500">{s.replace(/_/g, " ")}</p>
              <p className="tabular mt-0.5 text-lg font-semibold text-slate-900">{byStatus[s] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-700">{label}</span>
        <span className="tabular font-mono text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
