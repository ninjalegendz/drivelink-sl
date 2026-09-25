import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminAnalyticsView, RANGE_TABS } from "@/components/admin/ops/AdminAnalyticsView";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY,
} from "@/lib/demo/admin";
import { DEMO_ADMIN_ANALYTICS } from "@/lib/demo/admin-ops";
import type { TrafficRangeKey } from "@/lib/analytics/traffic";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

// See src/app/(admin)/admin/analytics/page.tsx for the data-fetching original.
export default async function DesignAdminAnalyticsPage({ searchParams }: Props) {
  guardDesignPreview();
  const { range } = await searchParams;
  const rangeKey = (RANGE_TABS.find((t) => t.key === range)?.key ?? "30d") as TrafficRangeKey;

  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <AdminAnalyticsView {...DEMO_ADMIN_ANALYTICS} rangeKey={rangeKey} />
    </AdminShell>
  );
}
