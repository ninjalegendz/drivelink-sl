import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { RenterListView } from "@/components/admin/people/RenterListView";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { DEMO_RENTERS } from "@/lib/demo/admin-people";

// Renders the real AdminShell + RenterListView with sample data. See
// src/app/(admin)/admin/users/page.tsx for the data-fetching original.
export default function DesignAdminUsersPage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <RenterListView users={DEMO_RENTERS} activeKyc={undefined} />
    </AdminShell>
  );
}
