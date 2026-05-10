import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VehicleForm } from "@/components/dashboard/VehicleForm";

export default async function NewVehiclePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/vehicles/new");

  const { data: agencyData } = await supabase
    .from("agencies")
    .select("id, city")
    .eq("owner_id", user.id)
    .single();

  if (!agencyData) redirect("/signup/agency");
  const agency = agencyData as { id: string; city: string };

  return (
    <div>
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to fleet
      </Link>

      <h1 className="text-2xl font-bold text-white mb-1">Add a vehicle</h1>
      <p className="text-slate-400 text-sm mb-8">
        Renters see this listing the moment you save it.
      </p>

      <VehicleForm agencyId={agency.id} agencyCity={agency.city} />
    </div>
  );
}
