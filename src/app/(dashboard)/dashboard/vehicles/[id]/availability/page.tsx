import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AvailabilityManager } from "@/components/dashboard/AvailabilityManager";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VehicleAvailabilityPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/vehicles/${id}/availability`);

  const { data: agencyData } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!agencyData) redirect("/signup?intent=provider");
  const agency = agencyData as { id: string };

  // Confirm this vehicle is theirs
  const { data: vehicleData } = await supabase
    .from("vehicles")
    .select("id, make, model, year")
    .eq("id", id)
    .eq("agency_id", agency.id)
    .single();
  if (!vehicleData) notFound();
  const vehicle = vehicleData as { id: string; make: string; model: string; year: number };

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

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to fleet
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Availability, {vehicle.year} {vehicle.make} {vehicle.model}
      </h1>
      <p className="text-slate-600 text-sm mb-8">
        Block dates when the vehicle isn&apos;t available for rental, maintenance,
        owner using it, agency holiday, anything. Renters won&apos;t see these
        dates as bookable.
      </p>

      <AvailabilityManager vehicleId={vehicle.id} agencyId={agency.id} initial={blocks} />
    </div>
  );
}
