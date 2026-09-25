import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AgencyAnalyticsView, ANALYTICS_RANGE_TABS, type AnalyticsRangeKey } from "@/components/dashboard/AgencyAnalyticsView";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";
import {
  DEMO_ANALYTICS_BY_STATUS, DEMO_ANALYTICS_TREND, DEMO_ANALYTICS_MONEY, DEMO_ANALYTICS_FUNNEL,
} from "@/lib/demo/dashboard-business";

// Same shell as /design/dashboard, with the Analytics screen as its content.
// The range tabs still navigate (?range=...), the preview simply keeps
// showing this same sample range regardless, which is enough to review the
// segmented control's look and motion. See src/app/design/layout.tsx: this
// whole area 404s in production.
export default async function DesignAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  guardDesignPreview();
  const { range } = await searchParams;
  const rangeKey: AnalyticsRangeKey = ANALYTICS_RANGE_TABS.find((t) => t.key === range)?.key ?? "30d";

  return (
    <DashboardShell
      activePage={DEMO_ACTIVE_PAGE}
      pageOptions={DEMO_PAGE_OPTIONS}
      navItems={DEMO_NAV_ITEMS}
      mobilePrimary={DEMO_MOBILE_PRIMARY}
      mobileSecondary={DEMO_MOBILE_SECONDARY}
      canManagePage
      blocker={null}
      pageId={DEMO_ACTIVE_PAGE.id}
      canViewBookings
    >
      <AgencyAnalyticsView
        basePath="/design/dashboard/analytics"
        rangeKey={rangeKey}
        agencyName={DEMO_ACTIVE_PAGE.name}
        agencyCity="Colombo"
        byStatus={DEMO_ANALYTICS_BY_STATUS}
        trend={DEMO_ANALYTICS_TREND}
        money={DEMO_ANALYTICS_MONEY}
        funnel={DEMO_ANALYTICS_FUNNEL}
      />
    </DashboardShell>
  );
}
