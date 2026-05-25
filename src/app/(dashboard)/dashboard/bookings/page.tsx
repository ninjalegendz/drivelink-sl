import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgencyBookingsList, AGENCY_BOOKINGS_SELECT, type AgencyBookingRow } from "@/components/bookings/AgencyBookingsList";
import type { BookingStatus } from "@/types/database";

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

  const { data: agencyData } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!agencyData) redirect("/signup?role=agency");

  const agency = agencyData as { id: string };

  let query = supabase
    .from("bookings")
    .select(AGENCY_BOOKINGS_SELECT)
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  if (filterStatus) query = query.eq("status", filterStatus as BookingStatus);

  const { data } = await query.limit(50);
  const bookings = (data ?? []) as unknown as AgencyBookingRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Bookings</h1>

      <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit">
        {FILTER_TABS.map(({ label, value }) => (
          <a
            key={value}
            href={value ? `/dashboard/bookings?status=${value}` : "/dashboard/bookings"}
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

      <AgencyBookingsList
        initial={bookings}
        agencyId={agency.id}
        filterStatus={(filterStatus ?? "") as BookingStatus | ""}
      />
    </div>
  );
}
