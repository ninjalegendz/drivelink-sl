import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageSettingsView } from "@/components/dashboard/PageSettingsView";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";
import {
  DEMO_SETTINGS_PAGE, DEMO_SETTINGS_TRANSFER, DEMO_TEAM_MEMBERS, DEMO_TEAM_PENDING,
} from "@/lib/demo/dashboard-business";

// Same shell as /design/dashboard, with the Settings screen as its content.
// See src/app/design/layout.tsx: this whole area 404s in production.
export default function DesignSettingsPage() {
  guardDesignPreview();
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
      <PageSettingsView
        page={DEMO_SETTINGS_PAGE}
        isOwner
        pendingTransfer={DEMO_SETTINGS_TRANSFER}
        teamMembers={DEMO_TEAM_MEMBERS}
        teamPending={DEMO_TEAM_PENDING}
      />
    </DashboardShell>
  );
}
