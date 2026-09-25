import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { responseTimeLabel } from "@/lib/vehicles/format";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { TodayView, type BookingLite, type FleetLite } from "@/components/dashboard/TodayView";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const agency = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  const canViewBookings = pageAccess.capabilities.includes("view_bookings");
  const canManageBooking = pageAccess.capabilities.includes("manage_booking");
  const canManageHandover = pageAccess.capabilities.includes("manage_handover");
  const canManageCases = pageAccess.capabilities.includes("manage_cases");
  const canManageFleet = pageAccess.capabilities.includes("manage_fleet");
  const canViewAnalytics = pageAccess.capabilities.includes("view_analytics");

  const bookingSelect = "id, status, created_at, start_date, end_date, start_time, end_time, total_days, subtotal_lkr, start_at, vehicles(make, model, year), profiles!renter_id(full_name, kyc_status)";

  const [{ data: pendingData }, { data: activeData }, { data: fleetData }, { count: monthCount }, { data: statsRow }] = await Promise.all([
    canViewBookings ? supabase.from("bookings").select(bookingSelect).eq("agency_id", agency.id).eq("status", "pending_confirmation").order("created_at", { ascending: true }).limit(20) : Promise.resolve({ data: [] }),
    canViewBookings ? supabase.from("bookings").select(bookingSelect).eq("agency_id", agency.id).eq("status", "active").order("start_date", { ascending: true }).limit(20) : Promise.resolve({ data: [] }),
    canManageFleet ? supabase.from("vehicles").select("id, make, model, year, status, slug, daily_rate_lkr, photos, is_featured").eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    canViewAnalytics ? supabase.from("bookings").select("*", { count: "exact", head: true }).eq("agency_id", agency.id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()) : Promise.resolve({ count: 0 }),
    supabase.from("agencies").select("avg_response_minutes").eq("id", agency.id).single(),
  ]);

  const pending = (pendingData ?? []) as unknown as BookingLite[];
  const active  = (activeData ?? []) as unknown as BookingLite[];
  const fleet   = (fleetData ?? []) as unknown as FleetLite[];
  const avgResponseMinutes = (statsRow as { avg_response_minutes: number | null } | null)?.avg_response_minutes ?? null;
  const responseLabel = responseTimeLabel(avgResponseMinutes);

  return (
    <TodayView
      pageName={agency.name}
      city={agency.city}
      isVerified={agency.is_verified}
      responseLabel={responseLabel}
      reliabilityPct={agency.reliability_pct}
      pending={pending}
      active={active}
      fleet={fleet}
      monthCount={monthCount ?? 0}
      canViewBookings={canViewBookings}
      canManageBooking={canManageBooking}
      canManageHandover={canManageHandover}
      canManageCases={canManageCases}
      canManageFleet={canManageFleet}
      canViewAnalytics={canViewAnalytics}
    />
  );
}
