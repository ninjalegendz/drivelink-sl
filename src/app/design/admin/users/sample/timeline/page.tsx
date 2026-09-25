import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { RenterTimelineView } from "@/components/admin/people/RenterTimelineView";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { DEMO_RENTER_TIMELINE, DEMO_RENTER_EVENTS, DEMO_RENTER_BROWSING } from "@/lib/demo/admin-people";

// See src/app/(admin)/admin/users/[id]/timeline/page.tsx for the data-fetching original.
export default function DesignAdminUserTimelinePage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <RenterTimelineView profile={DEMO_RENTER_TIMELINE} events={DEMO_RENTER_EVENTS} browsing={DEMO_RENTER_BROWSING} />
    </AdminShell>
  );
}
