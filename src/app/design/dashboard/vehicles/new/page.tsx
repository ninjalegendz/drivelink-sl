import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { VehicleWizard } from "@/components/dashboard/VehicleWizard";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";

// The listing wizard inside the dashboard shell, so the owner's most
// important flow can be reviewed without an identity-verified account.
// Nothing here submits: the wizard only saves when its final step is sent,
// and this preview is never reached in production (src/app/design/layout.tsx).
export default function DesignNewVehiclePage() {
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
      <div className="max-w-3xl space-y-8">
        <PageHeader
          title="List a vehicle"
          description="Three short steps. Everything else has a sensible default you can change later."
          backHref="/design/dashboard/vehicles"
          backLabel="Fleet"
        />
        <VehicleWizard agencyId={DEMO_ACTIVE_PAGE.id} agencyCity="Colombo" canDeclareListingAuthority />
      </div>
    </DashboardShell>
  );
}
