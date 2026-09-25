import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AvailabilityManager } from "@/components/dashboard/AvailabilityManager";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";
import { DEMO_AVAILABILITY_VEHICLE, DEMO_AVAILABILITY_BLOCKS, DEMO_AVAILABILITY_BOOKED } from "@/lib/demo/dashboard-fleet";

// The availability calendar against a sample vehicle with one past-facing
// block, one upcoming block and one confirmed booking, so the month view,
// the legend and the clash warning can all be reviewed. Nothing here saves:
// this preview is never reached in production (src/app/design/layout.tsx).
export default function DesignVehicleAvailabilityPage() {
  guardDesignPreview();
  const v = DEMO_AVAILABILITY_VEHICLE;
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
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title={`Availability, ${v.year} ${v.make} ${v.model}`}
          description="Block dates when the vehicle isn't available for rental, maintenance, owner using it, agency holiday, anything. Renters won't see these dates as bookable."
          backHref="/design/dashboard/vehicles"
          backLabel="Fleet"
        />
        <AvailabilityManager
          vehicleId={v.id}
          agencyId={DEMO_ACTIVE_PAGE.id}
          initial={DEMO_AVAILABILITY_BLOCKS}
          booked={DEMO_AVAILABILITY_BOOKED}
        />
      </div>
    </DashboardShell>
  );
}
