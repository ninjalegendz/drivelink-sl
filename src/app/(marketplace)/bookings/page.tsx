import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RenterBookingsList, RENTER_BOOKINGS_SELECT, type RenterBookingRow } from "@/components/bookings/RenterBookingsList";

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/bookings");

  const { data } = await supabase
    .from("bookings")
    .select(RENTER_BOOKINGS_SELECT)
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  const bookings = (data ?? []) as unknown as RenterBookingRow[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">My Bookings</h1>
      <RenterBookingsList initial={bookings} renterId={user.id} />
    </div>
  );
}
