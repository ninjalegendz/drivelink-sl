import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AgencyTimelineView } from "@/components/admin/people/AgencyTimelineView";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { DEMO_AGENCY_TIMELINE, DEMO_AGENCY_EVENTS } from "@/lib/demo/admin-people";

// See src/app/(admin)/admin/agencies/[id]/timeline/page.tsx for the data-fetching original.
export default function DesignAdminAgencyTimelinePage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <AgencyTimelineView agency={DEMO_AGENCY_TIMELINE} events={DEMO_AGENCY_EVENTS} />
    </AdminShell>
  );
}
