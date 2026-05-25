import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VehicleForm } from "@/components/dashboard/VehicleForm";
import { AgencyVerificationGate } from "@/components/dashboard/AgencyVerificationGate";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditVehiclePage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/vehicles/${id}/edit`);

  const [{ data: agencyData }, { data: profileData }] = await Promise.all([
    supabase.from("agencies").select("id, city, is_verified").eq("owner_id", user.id).single(),
    supabase.from("profiles").select("kyc_status").eq("id", user.id).single(),
  ]);

  if (!agencyData) redirect("/signup/agency");
  const agency  = agencyData  as { id: string; city: string; is_verified: boolean };
  const profile = profileData as { kyc_status: string } | null;

  const ownerKycVerified = profile?.kyc_status === "verified";
  const agencyApproved   = agency.is_verified;
  const canEdit          = ownerKycVerified && agencyApproved;

  const { data: vehicleData } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("agency_id", agency.id)
    .single();

  if (!vehicleData) notFound();
  const vehicle = vehicleData as VehicleRow;

  return (
    <div>
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to fleet
      </Link>

      <h1 className="text-2xl font-bold text-white mb-1">
        Edit {vehicle.year} {vehicle.make} {vehicle.model}
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        Changes go live immediately on the public listing.
      </p>

      {canEdit
        ? <VehicleForm agencyId={agency.id} agencyCity={agency.city} vehicle={vehicle} />
        : <AgencyVerificationGate ownerKycVerified={ownerKycVerified} agencyApproved={agencyApproved} />}
    </div>
  );
}
