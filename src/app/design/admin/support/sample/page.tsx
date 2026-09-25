import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { SupportThreadView } from "@/components/admin/ops/SupportThreadView";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY,
} from "@/lib/demo/admin";
import { DEMO_SUPPORT_THREAD_HEADER, DEMO_SUPPORT_MESSAGES } from "@/lib/demo/admin-ops";

// See src/app/(admin)/admin/support/[id]/page.tsx for the data-fetching
// original. SupportChat marks the thread read on mount with a real Supabase
// update scoped to this thread id. DEMO_SUPPORT_THREAD_HEADER.id sits in the
// same reserved UUID range as the rest of the demo fixtures (see
// src/lib/demo/fixtures.ts), so that update matches no real row and is a
// harmless no-op.
export default function DesignAdminSupportThreadPage() {
  guardDesignPreview();
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <SupportThreadView
        thread={DEMO_SUPPORT_THREAD_HEADER}
        messages={DEMO_SUPPORT_MESSAGES}
        currentUserId="00000000-0000-4000-8000-00000000ad01"
      />
    </AdminShell>
  );
}
