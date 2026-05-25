import { createClient } from "@/lib/supabase/server";
import { AdminBookingsList, ADMIN_BOOKINGS_SELECT, type AdminBookingRow } from "@/components/bookings/AdminBookingsList";
import type { BookingStatus } from "@/types/database";

const TABS: { label: string; value: string }[] = [
  { label: "All",           value: "" },
  { label: "Pending slip",  value: "payment_pending" },
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
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(ADMIN_BOOKINGS_SELECT)
    .order("created_at", { ascending: false });

  if (filterStatus) query = query.eq("status", filterStatus as BookingStatus);

  const { data } = await query.limit(100);
  const bookings = (data ?? []) as unknown as AdminBookingRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">All Bookings</h1>

      <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(({ label, value }) => (
          <a
            key={value}
            href={value ? `/admin/bookings?status=${value}` : "/admin/bookings"}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterStatus === value || (!filterStatus && !value)
                ? "bg-slate-700 text-white font-medium"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <AdminBookingsList
        initial={bookings}
        filterStatus={(filterStatus ?? "") as BookingStatus | ""}
      />
    </div>
  );
}
