import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AgencyBookingsList } from "@/components/bookings/AgencyBookingsList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
  DEMO_AGENCY_BOOKINGS,
} from "@/lib/demo/dashboard";

const FILTER_LABELS = ["All", "Pending", "Confirmed", "Active", "Completed"];

// Same shell as /design/dashboard, with the Bookings screen as its content.
// AgencyBookingsList polls Supabase for fresh rows in the background; without
// a real session that poll simply returns nothing and the sample rows below
// stay on screen (see usePolledRows: a null poll result never overwrites the
// seeded state). See src/app/design/layout.tsx: this whole area 404s in
// production.
export default function DesignBookingsPage() {
  guardDesignPreview();
  return (
    <DashboardShell
      activePage={DEMO_ACTIVE_PAGE}
      pageOptions={DEMO_PAGE_OPTIONS}
      navItems={DEMO_NAV_ITEMS}
      mobilePrimary={DEMO_MOBILE_PRIMARY}
      mobileSecondary={DEMO_MOBILE_SECONDARY}
      canManagePage
      blocker={null}
      pageId={DEMO_ACTIVE_PAGE.id}
      canViewBookings
    >
      <div>
        <PageHeader
          title="Bookings"
          description="Every request and rental for this Rental Page, newest first."
        />

        <div className="my-6 flex flex-wrap gap-2">
          {FILTER_LABELS.map((label, i) => (
            <Chip key={label} active={i === 0} count={i === 0 ? DEMO_AGENCY_BOOKINGS.length : undefined}>
              {label}
            </Chip>
          ))}
        </div>

        <AgencyBookingsList
          initial={DEMO_AGENCY_BOOKINGS}
          agencyId={DEMO_ACTIVE_PAGE.id}
          currentUserId="00000000-0000-4000-8000-00000000d001"
          filterStatus=""
          canExportSummary
          isPageOwner
          canManageBooking
          canManageHandover
          canCommunicate
          canManageCases
          canManageFinancial
        />
      </div>
    </DashboardShell>
  );
}
