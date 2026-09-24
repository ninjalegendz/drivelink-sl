import { guardDesignPreview } from "@/app/design/guard";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminHomeView } from "@/components/admin/shell/AdminHomeView";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY, DEMO_ADMIN_HOME,
} from "@/lib/demo/admin";

export const metadata: Metadata = { title: "Design preview, Admin" };

// Renders the real AdminShell + AdminHomeView with sample data. There is no
// real admin account to screenshot against in a fresh environment, and even
// with one, an admin inbox that happens to be empty is a bad way to judge a
// triage-queue redesign. See src/app/(admin)/layout.tsx and
// src/app/(admin)/admin/page.tsx for the data-fetching originals.
export default function AdminDesignPreviewPage() {
  guardDesignPreview();
  return (
    <AdminShell
      navItems={DEMO_ADMIN_NAV}
      mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY}
      mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}
    >
      <AdminHomeView {...DEMO_ADMIN_HOME} />
    </AdminShell>
  );
}
