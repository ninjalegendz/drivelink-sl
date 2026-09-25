import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipLink } from "@/components/ui/Chip";
import { AdminBookingsList } from "@/components/bookings/AdminBookingsList";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY,
} from "@/lib/demo/admin";
import { DEMO_ADMIN_BOOKINGS } from "@/lib/demo/admin-ops";
import type { BookingStatus } from "@/types/database";

const TABS: { label: string; value: string }[] = [
  { label: "All",       value: "" },
  { label: "Active",    value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Declined",  value: "declined" },
  { label: "Disputed",  value: "disputed" },
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

// See src/app/(admin)/admin/bookings/page.tsx for the data-fetching original.
// AdminBookingsList polls Supabase for fresh rows in the background; without a
// real session that poll simply returns nothing and the sample rows below
// stay on screen (see usePolledRows: a null poll result never overwrites the
// seeded state).
export default async function DesignAdminBookingsPage({ searchParams }: Props) {
  guardDesignPreview();
  const { status: filterStatus } = await searchParams;
  const bookings = filterStatus
    ? DEMO_ADMIN_BOOKINGS.filter((b) => b.status === filterStatus)
    : DEMO_ADMIN_BOOKINGS;

  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <div className="max-w-6xl">
        <PageHeader title="All bookings" description="Every request and rental across the marketplace, newest first." />

        <div className="my-6 flex flex-wrap gap-2">
          {TABS.map(({ label, value }) => (
            <ChipLink
              key={value}
              href={value ? `/admin/bookings?status=${value}` : "/admin/bookings"}
              active={(filterStatus ?? "") === value}
            >
              {label}
            </ChipLink>
          ))}
        </div>

        <AdminBookingsList initial={bookings} filterStatus={(filterStatus ?? "") as BookingStatus | ""} />
      </div>
    </AdminShell>
  );
}
