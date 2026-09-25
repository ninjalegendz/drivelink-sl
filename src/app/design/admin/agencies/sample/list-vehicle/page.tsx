import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { ListVehicleView } from "@/components/admin/people/ListVehicleView";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { DEMO_LIST_VEHICLE } from "@/lib/demo/admin-people";

// See src/app/(admin)/admin/agencies/[id]/list-vehicle/page.tsx for the data-fetching original.
// Nothing here submits: the wizard only saves when its final step is sent,
// and this preview is never reached in production (src/app/design/layout.tsx).
export default function DesignAdminListVehiclePage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <ListVehicleView {...DEMO_LIST_VEHICLE} />
    </AdminShell>
  );
}
