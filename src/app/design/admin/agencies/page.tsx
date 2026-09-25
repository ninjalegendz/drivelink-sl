import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AgencyListView } from "@/components/admin/people/AgencyListView";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { DEMO_AGENCIES } from "@/lib/demo/admin-people";

// See src/app/(admin)/admin/agencies/page.tsx for the data-fetching original.
export default function DesignAdminAgenciesPage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <AgencyListView agencies={DEMO_AGENCIES} />
    </AdminShell>
  );
}
