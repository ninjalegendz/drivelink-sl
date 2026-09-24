import { createServiceClient } from "@/lib/supabase/server";
import { AdminHomeView, type RecentBooking } from "@/components/admin/shell/AdminHomeView";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

export const metadata = { title: "Home, Admin" };

// Home = the old Action Inbox (everything that needs you) re-presented as a
// triage queue, followed by the at-a-glance metrics + recent bookings. One
// page, no click-through to a separate inbox. AdminHomeView owns the
// presentation; this file owns every query and count, unchanged from before
// the split.
export default async function AdminHomePage() {
  // Service client: these admin dashboards read protected profile columns
  // (phone, email, KYC docs, blacklist state) that browser sessions can no
  // longer SELECT. The (admin) layout enforces the admin role upstream.
  const supabase = await createServiceClient();

  const [
    { data: vehiclesData },
    { data: threadsData },
    { count: liveVehicles },
    { count: activeBookings },
    { count: renters },
    { count: agencies },
    { data: recentBookings },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*, agencies(name, city, whatsapp_number)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("support_threads")
      .select("id, agency_id, last_message_at, agencies(name)")
      .eq("has_unread_admin", true)
      .order("last_message_at", { ascending: true })
      .limit(30),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "renter"),
    supabase.from("agencies").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("id, status, start_date, end_date, start_time, end_time, created_at, vehicles(make, model, year), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const vehicles = (vehiclesData ?? []) as unknown as (VehicleRow & { agencies: { name: string; city: string; whatsapp_number: string } | null })[];
  const threads = (threadsData ?? []) as unknown as {
    id: string; agency_id: string; last_message_at: string; agencies: { name: string } | null;
  }[];
  const recent = (recentBookings ?? []) as unknown as RecentBooking[];

  return (
    <AdminHomeView
      pendingVehiclesCount={vehicles.length}
      unreadThreadsCount={threads.length}
      liveVehicles={liveVehicles ?? 0}
      activeBookings={activeBookings ?? 0}
      renters={renters ?? 0}
      agencies={agencies ?? 0}
      recentBookings={recent}
    />
  );
}
