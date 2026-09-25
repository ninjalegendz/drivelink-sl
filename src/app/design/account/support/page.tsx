import { guardDesignPreview } from "@/app/design/guard";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { SupportChat } from "@/components/support/SupportChat";
import { pageShellClass } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEMO_PROFILE } from "@/lib/demo/account";
import { DEMO_RENTER_SUPPORT_THREAD_ID, DEMO_RENTER_SUPPORT_MESSAGES } from "@/lib/demo/account-more";

export const metadata = { title: "Design preview: renter support" };

// Renders the real SupportChat with sample messages. It marks the thread
// read and opens a realtime channel on mount; without a real session both
// simply fail quietly and the seeded messages below stay on screen. See
// src/app/design/layout.tsx: this whole area 404s in production.
export default function DesignAccountSupportPage() {
  guardDesignPreview();
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name={DEMO_PROFILE.full_name} avatarUrl={null} />
      <div className={pageShellClass("narrow", "space-y-5 py-8")}>
        <PageHeader
          title="Support"
          description="Direct line to the DriveLink team. Help with verification, a booking, a payment, or a dispute."
          backHref="/account"
          backLabel="Account"
        />
        <SupportChat
          threadId={DEMO_RENTER_SUPPORT_THREAD_ID}
          initial={DEMO_RENTER_SUPPORT_MESSAGES}
          currentRole="renter"
          currentUserId="00000000-0000-4000-8000-00000000f002"
          audience="renter"
        />
      </div>
      <Footer />
    </div>
  );
}
