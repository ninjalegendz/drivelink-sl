import { guardDesignPreview } from "@/app/design/guard";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { RenterBookingsList } from "@/components/bookings/RenterBookingsList";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEMO_BOOKINGS } from "@/lib/demo/account";

export const metadata: Metadata = { title: "Design preview: bookings" };

// Renders the real RenterBookingsList presentational component with sample
// data, so the signed-in bookings list can be reviewed without a verified
// account. See src/app/design/layout.tsx: this whole area 404s in production.
export default function DesignBookingsPage() {
  guardDesignPreview();
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name="Ayesha Perera" avatarUrl={null} />

      <PageShell width="narrow">
        <PageHeader
          title="Your bookings"
          description="Every request you have sent, and every rental in progress."
          actions={
            <Link href="/vehicles" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800">
              Browse vehicles <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        />
        <RenterBookingsList initial={DEMO_BOOKINGS} />
      </PageShell>

      <Footer />
    </div>
  );
}
