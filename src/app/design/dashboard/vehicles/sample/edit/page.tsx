import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { VehicleForm } from "@/components/dashboard/VehicleForm";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";
import { DEMO_EDIT_VEHICLE, DEMO_VEHICLE_DOCUMENTS } from "@/lib/demo/dashboard-fleet";

// The full edit form, restyled into grouped sections with an in-page nav,
// against a fully filled sample vehicle. Nothing here saves: this preview is
// never reached in production (src/app/design/layout.tsx).
export default function DesignEditVehiclePage() {
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
      <div className="space-y-6 pb-24 lg:pb-8">
        <PageHeader
          title={`Edit ${DEMO_EDIT_VEHICLE.year} ${DEMO_EDIT_VEHICLE.make} ${DEMO_EDIT_VEHICLE.model}`}
          description="Important listing changes may need a new DriveLink review before renters see them."
          backHref="/design/dashboard/vehicles"
          backLabel="Fleet"
        />
        <VehicleForm
          agencyId={DEMO_ACTIVE_PAGE.id}
          agencyCity="Colombo"
          vehicle={DEMO_EDIT_VEHICLE}
          documents={DEMO_VEHICLE_DOCUMENTS}
          canDeclareListingAuthority
        />
      </div>
    </DashboardShell>
  );
}
