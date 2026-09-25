import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { SupportInboxView } from "@/components/admin/ops/SupportInboxView";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY,
} from "@/lib/demo/admin";
import { DEMO_SUPPORT_THREADS } from "@/lib/demo/admin-ops";

// See src/app/(admin)/admin/support/page.tsx for the data-fetching original.
export default function DesignAdminSupportPage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <SupportInboxView threads={DEMO_SUPPORT_THREADS} />
    </AdminShell>
  );
}
