import type { Metadata } from "next";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { BookingDetailView } from "@/components/bookings/BookingDetailView";
import { DEMO_BOOKING_DETAIL } from "@/lib/demo/account";

export const metadata: Metadata = { title: "Design preview: booking detail" };

// Renders the real BookingDetailView presentational component with sample
// data, so a renter's booking detail can be reviewed without a verified
// account or a real confirmed booking. See src/app/design/layout.tsx: this
// whole area 404s in production.
export default function DesignBookingSamplePage() {
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name="Ayesha Perera" avatarUrl={null} />
      <BookingDetailView {...DEMO_BOOKING_DETAIL} />
      <Footer />
    </div>
  );
}
