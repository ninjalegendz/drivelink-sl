import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipLink } from "@/components/ui/Chip";
import { AdminBookingsList } from "@/components/bookings/AdminBookingsList";
import { ADMIN_BOOKINGS_SELECT, type AdminBookingRow } from "@/components/bookings/admin-bookings-query";
import type { BookingStatus } from "@/types/database";

const TABS: { label: string; value: string }[] = [
  { label: "All",           value: "" },
  { label: "Active",        value: "active" },
  { label: "Completed",     value: "completed" },
  { label: "Declined",      value: "declined" },
  { label: "Disputed",      value: "disputed" },
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const { status: filterStatus } = await searchParams;
  // Service client: these admin dashboards read protected profile columns
  // (phone, email, KYC docs, blacklist state) that browser sessions can no
  // longer SELECT. The (admin) layout enforces the admin role upstream.
  const supabase = await createServiceClient();

  let query = supabase
    .from("bookings")
    .select(ADMIN_BOOKINGS_SELECT)
    .order("created_at", { ascending: false });

  if (filterStatus) query = query.eq("status", filterStatus as BookingStatus);

  const { data } = await query.limit(100);
  const bookings = (data ?? []) as unknown as AdminBookingRow[];

  return (
    <div className="max-w-6xl">
      <PageHeader title="All bookings" description="Every request and rental across the marketplace, newest first." />

      <div className="my-6 flex flex-wrap gap-2">
        {TABS.map(({ label, value }) => (
          <ChipLink
            key={value}
            href={value ? `/admin/bookings?status=${value}` : "/admin/bookings"}
            active={filterStatus === value || (!filterStatus && !value)}
          >
            {label}
          </ChipLink>
        ))}
      </div>

      <AdminBookingsList
        initial={bookings}
        filterStatus={(filterStatus ?? "") as BookingStatus | ""}
      />
    </div>
  );
}
