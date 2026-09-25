import { BarChart3, TrendingUp, Wallet, Receipt, CalendarClock, ShieldCheck, XCircle, Flag } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { RangeTabs } from "@/components/analytics/RangeTabs";
import { Sparkline } from "@/components/analytics/Sparkline";
import { formatLKR } from "@/lib/vehicles/format";
import { formatDay } from "@/lib/dates/display";

export type AnalyticsRangeKey = "7d" | "30d" | "90d" | "ytd";

export const ANALYTICS_RANGE_TABS: { key: AnalyticsRangeKey; label: string }[] = [
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "Year to date" },
];

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "Pending",
  confirmed:            "Confirmed",
  active:               "Active",
  completed:            "Completed",
  declined:             "Declined",
  cancelled:            "Cancelled",
  disputed:             "Disputed",
};

export interface AgencyAnalyticsViewProps {
  /** Route the range selector applies to, e.g. "/dashboard/analytics". */
  basePath: string;
  rangeKey: AnalyticsRangeKey;
  agencyName: string;
  agencyCity: string;
  byStatus: Record<string, number>;
  trend: Array<{ date: string; count: number }>;
  money: { completed: number; rental_revenue: number; confirmation_fees: number };
  funnel: { requested: number; reserved: number; started: number; completed: number };
}

/**
 * The Rental Page's own analytics: what happened, not what to do next (that's
 * Today). Presentation only, every number here comes from the four queries in
 * (dashboard)/dashboard/analytics/page.tsx, unchanged.
 */
export function AgencyAnalyticsView({
  basePath, rangeKey, agencyName, agencyCity, byStatus, trend, money, funnel,
}: AgencyAnalyticsViewProps) {
  const trendValues = trend.map((d) => d.count);
  const totalRequests = funnel.requested;
  const confRate = totalRequests > 0 ? Math.round((funnel.reserved / totalRequests) * 100) : 0;
  const cancelRate = totalRequests > 0
    ? Math.round((((byStatus.cancelled ?? 0) + (byStatus.declined ?? 0)) / totalRequests) * 100)
    : 0;
  const compRate = funnel.started > 0 ? Math.round((funnel.completed / funnel.started) * 100) : 0;
  const hasTrendData = trendValues.some((v) => v > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`${agencyName} · ${agencyCity}`}
        eyebrow="Performance"
      />

      <RangeTabs tabs={ANALYTICS_RANGE_TABS} active={rangeKey} basePath={basePath} />

      <Section title="This range">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Booking requests" value={totalRequests} icon={<CalendarClock size={14} aria-hidden="true" />} />
          <Stat
            label="Conversion to booking"
            value={`${confRate}%`}
            hint={`${funnel.reserved} confirmed`}
            icon={<ShieldCheck size={14} aria-hidden="true" />}
          />
          <Stat
            label="Cancellation rate"
            value={`${cancelRate}%`}
            tone={cancelRate > 30 ? "risk" : "neutral"}
            hint={`${(byStatus.cancelled ?? 0) + (byStatus.declined ?? 0)} cancelled or declined`}
            icon={<XCircle size={14} aria-hidden="true" />}
          />
          <Stat
            label="Completion rate"
            value={`${compRate}%`}
            hint={`${funnel.completed} completed`}
            icon={<Flag size={14} aria-hidden="true" />}
          />
        </div>
      </Section>

      <Section title="Daily booking requests" description={`${trend.length} days in this range`}>
        <Card padding="lg">
          {hasTrendData ? (
            <>
              <Sparkline values={trendValues} width={800} height={90} className="h-24 w-full" />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{trend[0] ? formatDay(trend[0].date) : ""}</span>
                <span>{trend.length > 0 ? formatDay(trend[trend.length - 1].date) : ""}</span>
              </div>
            </>
          ) : (
            <EmptyState
              bare
              icon={<TrendingUp size={22} className="text-slate-400" strokeWidth={1.5} />}
              title="No booking requests in this range"
              description="Try a wider range, or check back once renters start requesting your vehicles."
            />
          )}
        </Card>
      </Section>

      <Section title="Money">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card padding="lg">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Wallet size={16} className="text-blue-600" aria-hidden="true" /> Your earnings</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular text-slate-950">{formatLKR(money.rental_revenue)}</p>
            <p className="mt-1 text-xs text-slate-500">Total rental revenue from {money.completed} completed booking{money.completed === 1 ? "" : "s"} in this range.</p>
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-600">
              <p>Renters pay the rental directly to you at pickup. DriveLink does not handle that money.</p>
              <p className="mt-1">
                Average per booking: <span className="tabular font-semibold text-slate-900">{formatLKR(money.completed > 0 ? Math.round(money.rental_revenue / money.completed) : 0)}</span>
              </p>
            </div>
          </Card>

          <Card padding="lg">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Receipt size={16} className="text-blue-600" aria-hidden="true" /> DriveLink charges to your page</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Rs. 0</p>
            <p className="mt-1 text-xs text-slate-500">No listing fee, monthly subscription, or commission is charged to your Rental Page.</p>
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-600">
              Renters pay the agreed rental and deposit directly to you. DriveLink does not deduct from that amount.
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Bookings by status" description="Within the selected range">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["pending_confirmation", "confirmed", "active", "completed", "declined", "cancelled", "disputed"] as const).map((s) => (
            <Stat key={s} label={STATUS_LABEL[s]} value={byStatus[s] ?? 0} icon={<BarChart3 size={14} aria-hidden="true" />} />
          ))}
        </div>
      </Section>
    </div>
  );
}
