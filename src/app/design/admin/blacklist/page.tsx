import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { BlacklistView } from "@/components/admin/people/BlacklistView";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { DEMO_BLACKLIST_REPORTS } from "@/lib/demo/admin-people";

// See src/app/(admin)/admin/blacklist/page.tsx for the data-fetching original.
export default function DesignAdminBlacklistPage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <BlacklistView reports={DEMO_BLACKLIST_REPORTS} />
    </AdminShell>
  );
}
