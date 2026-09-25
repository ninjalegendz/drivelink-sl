import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { AvailabilityManager } from "@/components/dashboard/AvailabilityManager";
import { PageHeader } from "@/components/ui/PageHeader";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VehicleAvailabilityPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/vehicles/${id}/availability`);

  const { page, pages } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const agency = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("manage_fleet")) redirect("/dashboard");

  // Confirm this vehicle belongs to one of this account's own Rental Pages.
  const { data: vehicleData } = await supabase
    .from("vehicles")
    .select("id, make, model, year, agency_id")
    .eq("id", id)
    .single();
  if (!vehicleData) notFound();
  const vehicle = vehicleData as { id: string; make: string; model: string; year: number; agency_id: string };

  // If it's on a different owned page than the active one, send them back to
  // the fleet list rather than error, it's not missing, just out of scope here.
  const ownedPageIds = new Set(pages.map((p) => p.id));
  if (!ownedPageIds.has(vehicle.agency_id)) notFound();
  if (vehicle.agency_id !== agency.id) redirect("/dashboard/vehicles");

  // Existing future blocks
  const todayIso = new Date().toISOString().split("T")[0];
  const { data: blockRows } = await supabase
    .from("vehicle_blocks")
    .select("id, start_date, end_date, reason, created_at")
    .eq("vehicle_id", id)
    .gte("end_date", todayIso)
    .order("start_date", { ascending: true });

  const blocks = (blockRows ?? []) as {
    id:         string;
    start_date: string;
    end_date:   string;
    reason:     string | null;
    created_at: string;
  }[];

  // Dates a renter already holds. Blocking over one of these does not cancel
  // it, so the manager warns before the owner commits rather than leaving the
  // calendar and the bookings list disagreeing.
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("start_date, end_date")
    .eq("vehicle_id", id)
    .in("status", ["confirmed", "payment_pending", "active"])
    .gte("end_date", todayIso);

  const booked = (bookingRows ?? []) as { start_date: string; end_date: string }[];

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={`Availability, ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        description="Block dates when the vehicle isn't available for rental, maintenance, owner using it, agency holiday, anything. Renters won't see these dates as bookable."
        backHref="/dashboard/vehicles"
        backLabel="Fleet"
      />

      <AvailabilityManager vehicleId={vehicle.id} agencyId={agency.id} initial={blocks} booked={booked} />
    </div>
  );
}
