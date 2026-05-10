import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
import type { BookingWithRelations } from "@/types/queries";
import type { BookingStatus } from "@/types/database";

const statusVariant: Record<BookingStatus, "slate" | "yellow" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "yellow",
  confirmed:            "yellow",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "red",
};

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
    .select("*, vehicles(make, model, year), profiles(full_name, rating_avg, kyc_status)")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  if (filterStatus) query = query.eq("status", filterStatus as BookingStatus);

  const { data } = await query.limit(50);
  const bookings = (data ?? []) as unknown as BookingWithRelations[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Bookings</h1>

      {/* Filter tabs */}
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

      {bookings.length > 0 ? (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const vehicle = booking.vehicles;
            const renter  = booking.profiles;
            const status  = booking.status;

            return (
              <div key={booking.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">
                        {vehicle?.year} {vehicle?.make} {vehicle?.model}
                      </p>
                      <Badge variant={statusVariant[status]}>
                        {BOOKING_STATUS_LABELS[status]}
                      </Badge>
                    </div>

                    <p className="text-slate-400 text-sm mt-1">
                      {booking.start_date} → {booking.end_date} ({booking.total_days} days)
                    </p>

                    {renter && (
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-slate-300 text-sm">{renter.full_name}</p>
                        {renter.kyc_status === "verified" && (
                          <Badge variant="green">ID Verified</Badge>
                        )}
                        {renter.rating_avg && (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                            <Star size={11} fill="currentColor" className="text-amber-400" />
                            {renter.rating_avg.toFixed(1)}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-slate-500 text-xs mt-1">
                      Rental: {formatLKR(booking.subtotal_lkr)}
                    </p>
                  </div>

                  <AgencyBookingActions bookingId={booking.id} status={status} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <p>No bookings {filterStatus ? `with status "${filterStatus}"` : "yet"}.</p>
        </div>
      )}
    </div>
  );
}
