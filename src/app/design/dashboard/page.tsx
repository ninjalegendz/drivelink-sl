import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { TodayView } from "@/components/dashboard/TodayView";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
  DEMO_TODAY_PROPS, DEMO_BLOCKERS,
} from "@/lib/demo/dashboard";
import type { LivenessBlocker } from "@/lib/pages/liveness";

// Renders the real DashboardShell + TodayView presentational components with
// sample data, so the signed-in Rental Page home can be reviewed without a
// verified account. See src/app/design/layout.tsx: this whole area 404s in
// production.
//
// Pass ?blocker=phone_unverified (or any key in DEMO_BLOCKERS) to preview the
// "page not live" banner; the default shows the clean, fully-live state.
interface Props {
  searchParams: Promise<{ blocker?: string }>;
}

export default async function DesignDashboardPage({ searchParams }: Props) {
  const { blocker: blockerParam } = await searchParams;
  const blocker: LivenessBlocker | null = blockerParam && blockerParam in DEMO_BLOCKERS ? DEMO_BLOCKERS[blockerParam] : null;

  return (
    <DashboardShell
      activePage={DEMO_ACTIVE_PAGE}
      pageOptions={DEMO_PAGE_OPTIONS}
      navItems={DEMO_NAV_ITEMS}
      mobilePrimary={DEMO_MOBILE_PRIMARY}
      mobileSecondary={DEMO_MOBILE_SECONDARY}
      canManagePage
      blocker={blocker}
      pageId={DEMO_ACTIVE_PAGE.id}
      canViewBookings
    >
      <TodayView {...DEMO_TODAY_PROPS} />
    </DashboardShell>
  );
}
