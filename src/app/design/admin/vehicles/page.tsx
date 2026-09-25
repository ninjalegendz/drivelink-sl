import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { VehicleModerationView } from "@/components/admin/ops/VehicleModerationView";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY,
} from "@/lib/demo/admin";
import { DEMO_MODERATION_VEHICLES, DEMO_MODERATION_DOCS } from "@/lib/demo/admin-ops";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

// See src/app/(admin)/admin/vehicles/page.tsx for the data-fetching original.
export default async function DesignAdminVehiclesPage({ searchParams }: Props) {
  guardDesignPreview();
  const { status } = await searchParams;
  const activeFilter = status ?? "pending_review";

  const vehicles = activeFilter === "all"
    ? DEMO_MODERATION_VEHICLES
    : activeFilter === "auto"
      ? DEMO_MODERATION_VEHICLES.filter((v) => v.status === "available" && v.auto_published_at)
      : DEMO_MODERATION_VEHICLES.filter((v) => v.status === activeFilter);

  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <VehicleModerationView vehicles={vehicles} activeFilter={activeFilter} docsByVehicleId={DEMO_MODERATION_DOCS} />
    </AdminShell>
  );
}
