import { redirect } from "next/navigation";
import { BarChart3, TrendingUp, Wallet, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { Sparkline } from "@/components/analytics/Sparkline";
import { formatLKR } from "@/lib/vehicles/format";
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

const RANGE_TABS: { key: "7d" | "30d" | "90d" | "ytd"; label: string }[] = [
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "Year to date" },
];

export default async function AgencyAnalyticsPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const rangeKey = (RANGE_TABS.find((t) => t.key === rangeParam)?.key ?? "30d");
  const range = rangeForKey(rangeKey);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/analytics");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const agency = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("view_analytics")) redirect("/dashboard");

  const [byStatus, trend, money, funnel] = await Promise.all([
    bookingCountsByStatus(supabase, range, agency.id),
    dailyBookingTrend(supabase, range, agency.id),
    revenueTotals(supabase, range, agency.id),
    conversionFunnel(supabase, range, agency.id),
  ]);

  const trendValues = trend.map((d) => d.count);
  const totalRequests = funnel.requested;
  const confRate = totalRequests > 0 ? Math.round((funnel.reserved / totalRequests) * 100) : 0;
  const cancelRate = totalRequests > 0
    ? Math.round((((byStatus.cancelled ?? 0) + (byStatus.declined ?? 0)) / totalRequests) * 100)
    : 0;
  const compRate = funnel.started > 0 ? Math.round((funnel.completed / funnel.started) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">{agency.name} · {agency.city}</p>

      {/* Range tabs: switching one re-queries immediately. */}
      <RangeTabs tabs={RANGE_TABS} active={rangeKey} basePath="/dashboard/analytics" />

      {/* Top-line cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Booking requests"   value={totalRequests} />
        <Stat label="Conversion to booking" value={`${confRate}%`} subtitle={`${funnel.reserved} confirmed`} />
        <Stat label="Cancellation rate"  value={`${cancelRate}%`} tone={cancelRate > 30 ? "red" : "slate"} subtitle={`${(byStatus.cancelled ?? 0) + (byStatus.declined ?? 0)} cancelled/declined`} />
        <Stat label="Completion rate"    value={`${compRate}%`} subtitle={`${funnel.completed} completed`} />
      </div>

      {/* Trend */}
      <Card title="Daily booking requests" subtitle={`${trend.length} days`} Icon={TrendingUp}>
        <Sparkline values={trendValues} width={800} height={80} className="w-full h-20" />
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>{trend[0]?.date}</span>
          <span>{trend[trend.length - 1]?.date}</span>
        </div>
      </Card>

      {/* Financial */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Card title="Your earnings" Icon={Wallet}>
          <p className="text-3xl font-bold text-slate-900">{formatLKR(money.rental_revenue)}</p>
          <p className="text-slate-500 text-xs mt-1">
            Total rental revenue from {money.completed} completed bookings in this range
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <p>Renters pay rental directly to you at pickup, DriveLink doesn&apos;t handle that money.</p>
            <p className="mt-1">Average per booking: <span className="text-slate-900 font-medium">{formatLKR(money.completed > 0 ? Math.round(money.rental_revenue / money.completed) : 0)}</span></p>
          </div>
        </Card>

        <Card title="DriveLink charges to your page" Icon={Receipt}>
          <p className="text-3xl font-bold text-slate-900">Rs. 0</p>
          <p className="text-slate-500 text-xs mt-1">
            No listing fee, monthly subscription, or commission is charged to your Rental Page.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            Renters pay the agreed rental and deposit directly to you. DriveLink does not deduct from that amount.
          </div>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card title="Bookings by status" subtitle="Within selected range">
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

function Stat({ label, value, subtitle, tone }: { label: string; value: string | number; subtitle?: string; tone?: "red" | "slate" }) {
  const colourClass = tone === "red" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colourClass}`}>{value}</p>
      {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
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
