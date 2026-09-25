import { guardDesignPreview } from "@/app/design/guard";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { NewRentalPageView } from "@/components/account/NewRentalPageView";
import { DEMO_PROFILE } from "@/lib/demo/account";
import { DEMO_NEW_PAGE_DEFAULTS } from "@/lib/demo/account-more";

export const metadata = { title: "Design preview: create a Rental Page" };

// Renders the real NewRentalPageView, both scenarios stacked for review:
// an unverified account first, then a verified account with the pre-filled
// create form. Neither is a real route; only /account/pages/new in the
// product renders one at a time. See src/app/design/layout.tsx: this whole
// area 404s in production.
export default function DesignNewRentalPagePage() {
  guardDesignPreview();
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name={DEMO_PROFILE.full_name} avatarUrl={null} />

      <div className="py-8">
        <NewRentalPageView isVerified={false} defaults={DEMO_NEW_PAGE_DEFAULTS} />
      </div>

      <div className="mx-auto max-w-2xl px-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800 ring-1 ring-amber-200">
          Review only: a verified account&apos;s create form, below
        </p>
      </div>

      <div className="py-8">
        <NewRentalPageView isVerified defaults={DEMO_NEW_PAGE_DEFAULTS} />
      </div>

      <Footer />
    </div>
  );
}
