import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, TrendingUp, Wallet, Receipt, AlertTriangle } from "lucide-react";
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

export default async function AgencyAnalyticsPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const rangeKey = (RANGE_TABS.find((t) => t.key === rangeParam)?.key ?? "30d");
  const range = rangeForKey(rangeKey);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/analytics");

  const { data: agencyRow } = await supabase
    .from("agencies")
    .select("id, name, city")
    .eq("owner_id", user.id)
    .single();
  if (!agencyRow) redirect("/signup/agency");
  const agency = agencyRow as { id: string; name: string; city: string };

  const [byStatus, trend, money, funnel] = await Promise.all([
    bookingCountsByStatus(supabase, range, agency.id),
    dailyBookingTrend(supabase, range, agency.id),
    revenueTotals(supabase, range, agency.id),
    conversionFunnel(supabase, range, agency.id),
  ]);

  const trendValues = trend.map((d) => d.count);
  const totalRequests = funnel.requested;
  const confRate = totalRequests > 0 ? Math.round((funnel.confirmed / totalRequests) * 100) : 0;
  const cancelRate = totalRequests > 0
    ? Math.round((((byStatus.cancelled ?? 0) + (byStatus.declined ?? 0)) / totalRequests) * 100)
    : 0;
  const compRate = funnel.paid > 0 ? Math.round((funnel.completed / funnel.paid) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
      </div>
      <p className="text-slate-400 text-sm mb-5">{agency.name} · {agency.city}</p>

      {/* Range tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit flex-wrap">
        {RANGE_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/analytics?range=${t.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              rangeKey === t.key ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Top-line cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Booking requests"   value={totalRequests} />
        <Stat label="Conversion to booking" value={`${confRate}%`} subtitle={`${funnel.confirmed} confirmed`} />
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
          <p className="text-3xl font-bold text-white">{formatLKR(money.rental_revenue)}</p>
          <p className="text-slate-500 text-xs mt-1">
            Total rental revenue from {money.completed} completed bookings in this range
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <p>Renters pay rental directly to you at pickup — DriveLink doesn&apos;t handle that money.</p>
            <p className="mt-1">Average per booking: <span className="text-white font-medium">{formatLKR(money.completed > 0 ? Math.round(money.rental_revenue / money.completed) : 0)}</span></p>
          </div>
        </Card>

        <Card title="Platform fees" Icon={Receipt}>
          <p className="text-3xl font-bold text-white">{formatLKR(money.platform_fees)}</p>
          <p className="text-slate-500 text-xs mt-1">
            Rs. 200 × {money.completed} completed = what you owe DriveLink for this range
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Already paid</span>
              <span className="text-emerald-400">{formatLKR(money.collected_fees)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Outstanding</span>
              <span className={money.outstanding_fees > 0 ? "text-amber-400" : "text-slate-500"}>
                {formatLKR(money.outstanding_fees)}
              </span>
            </div>
          </div>
          {money.outstanding_fees > 0 && (
            <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[11px] text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>You have {formatLKR(money.outstanding_fees)} due. We invoice monthly — pay via bank transfer to the DriveLink account.</span>
            </div>
          )}
        </Card>
      </div>

      {/* Status breakdown */}
      <Card title="Bookings by status" subtitle="Within selected range">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["pending_confirmation", "confirmed", "payment_pending", "active", "completed", "declined", "cancelled", "disputed"] as const).map((s) => (
            <div key={s} className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">{s.replace(/_/g, " ")}</p>
              <p className="text-white text-lg font-semibold mt-0.5">{byStatus[s] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, subtitle, tone }: { label: string; value: string | number; subtitle?: string; tone?: "red" | "slate" }) {
  const colourClass = tone === "red" ? "text-red-400" : "text-white";
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colourClass}`}>{value}</p>
      {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function Card({ title, subtitle, children, Icon }: { title: string; subtitle?: string; children: React.ReactNode; Icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-3">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-amber-400" />}
        <h2 className="text-white font-semibold">{title}</h2>
        {subtitle && <span className="text-slate-500 text-xs">· {subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
