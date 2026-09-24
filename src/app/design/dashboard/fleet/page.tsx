import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FleetView } from "@/components/dashboard/FleetView";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
  DEMO_FLEET_VEHICLES,
} from "@/lib/demo/dashboard";

// Same shell as /design/dashboard, with the Fleet screen as its content.
// See src/app/design/layout.tsx: this whole area 404s in production.
export default function DesignFleetPage() {
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
      <FleetView
        vehicles={DEMO_FLEET_VEHICLES}
        agencyName={DEMO_ACTIVE_PAGE.name}
        agencyId={DEMO_ACTIVE_PAGE.id}
        canDeclareListingAuthority
      />
    </DashboardShell>
  );
}
