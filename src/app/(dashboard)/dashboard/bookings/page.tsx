import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActivePage } from "@/lib/pages/active-page";
import { AgencyBookingsList } from "@/components/bookings/AgencyBookingsList";
import { AGENCY_BOOKINGS_SELECT, type AgencyBookingRow } from "@/components/bookings/agency-bookings-query";
import type { BookingStatus } from "@/types/database";
import { getAgencyDocumentAccess, getPageAccess } from "@/lib/pages/access";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipLink } from "@/components/ui/Chip";

const FILTER_TABS = [
  { label: "All",       value: "" },
  { label: "Pending",   value: "pending_confirmation" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Active",    value: "active" },
  { label: "Completed", value: "completed" },
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AgencyBookingsPage({ searchParams }: Props) {
  const { status: filterStatus } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const agency = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("view_bookings")) redirect("/dashboard");

  // Service client: the renter trust embed (is_blacklisted /
  // blacklist_reason_public) reads protected profile columns that browser
  // sessions can no longer SELECT. Ownership is already proven above
  // (getActivePage), and the explicit agency_id filter scopes the rows.
  const service = await createServiceClient();
  let query = service
    .from("bookings")
    .select(AGENCY_BOOKINGS_SELECT)
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  if (filterStatus) query = query.eq("status", filterStatus as BookingStatus);

  const { data } = await query.limit(50);
  const bookings = (data ?? []) as unknown as AgencyBookingRow[];

  const documentAccess = await getAgencyDocumentAccess(service, user.id, agency.id);

  // A count on each filter is what turns a row of tabs into a work list: the
  // owner can see where the waiting work is without opening each one.
  const { data: statusRows } = await service
    .from("bookings")
    .select("status")
    .eq("agency_id", agency.id);
  const counts = new Map<string, number>();
  for (const row of (statusRows ?? []) as { status: string }[]) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  const totalBookings = (statusRows ?? []).length;

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Every request and rental for this Rental Page, newest first."
      />

      <div className="my-6 flex gap-2 overflow-x-auto scrollbar-none mask-fade-x -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {FILTER_TABS.map(({ label, value }) => (
          <ChipLink
            key={value}
            href={value ? `/dashboard/bookings?status=${value}` : "/dashboard/bookings"}
            active={filterStatus === value || (!filterStatus && !value)}
            count={value ? counts.get(value) ?? 0 : totalBookings}
          >
            {label}
          </ChipLink>
        ))}
      </div>

      <AgencyBookingsList
        initial={bookings}
        agencyId={agency.id}
        currentUserId={user.id}
        filterStatus={(filterStatus ?? "") as BookingStatus | ""}
        canExportSummary={documentAccess.allowed}
        isPageOwner={documentAccess.isOwner}
        canManageBooking={pageAccess.capabilities.includes("manage_booking")}
        canManageHandover={pageAccess.capabilities.includes("manage_handover")}
        canCommunicate={pageAccess.capabilities.includes("communicate")}
        canManageCases={pageAccess.capabilities.includes("manage_cases")}
        canManageFinancial={pageAccess.capabilities.includes("manage_financial")}
      />
    </div>
  );
}
