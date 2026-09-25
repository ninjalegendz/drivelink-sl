import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import {
  bookingCountsByStatus,
  dailyBookingTrend,
  revenueTotals,
  conversionFunnel,
  rangeForKey,
} from "@/lib/analytics/queries";
import { AgencyAnalyticsView, ANALYTICS_RANGE_TABS, type AnalyticsRangeKey } from "@/components/dashboard/AgencyAnalyticsView";

// Always re-query: these numbers are the reason someone opened the page.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function AgencyAnalyticsPage({ searchParams }: Props) {
  const { range: rangeParam } = await searchParams;
  const rangeKey: AnalyticsRangeKey = ANALYTICS_RANGE_TABS.find((t) => t.key === rangeParam)?.key ?? "30d";
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

  return (
    <AgencyAnalyticsView
      basePath="/dashboard/analytics"
      rangeKey={rangeKey}
      agencyName={agency.name}
      agencyCity={agency.city}
      byStatus={byStatus}
      trend={trend}
      money={money}
      funnel={funnel}
    />
  );
}
