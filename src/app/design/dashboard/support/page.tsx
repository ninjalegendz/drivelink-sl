import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupportChat } from "@/components/support/SupportChat";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";
import { DEMO_SUPPORT_THREAD_ID, DEMO_SUPPORT_MESSAGES } from "@/lib/demo/dashboard-business";

// Same shell as /design/dashboard, with the Support screen as its content.
// SupportChat marks the thread read and opens a realtime channel on mount;
// without a real session both simply fail quietly and the seeded messages
// below stay on screen. See src/app/design/layout.tsx: this whole area 404s
// in production.
export default function DesignSupportPage() {
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
      <div className="space-y-5">
        <PageHeader
          title="Support"
          description="Direct line to the DriveLink team for booking issues, safety concerns and listing review questions. A member of the team replies from here."
        />
        <SupportChat
          threadId={DEMO_SUPPORT_THREAD_ID}
          initial={DEMO_SUPPORT_MESSAGES}
          currentRole="agency_owner"
          currentUserId={DEMO_ACTIVE_PAGE.id}
          audience="agency"
        />
      </div>
    </DashboardShell>
  );
}
