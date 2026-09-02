import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
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

  const { page, pages } = await getActivePage(supabase, user.id);

  if (!page) redirect("/account/pages/new");
  const agency  = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("manage_fleet")) redirect("/dashboard");
  const service = await createServiceClient();
  const { data: profileData } = await service.from("profiles").select("kyc_status").eq("id", agency.owner_id).single();
  const profile = profileData as { kyc_status: string } | null;

  const ownerKycVerified = profile?.kyc_status === "verified";
  const canEdit          = ownerKycVerified;

  const { data: vehicleData } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single();

  if (!vehicleData) notFound();
  const vehicle = vehicleData as VehicleRow;

  // The vehicle must belong to one of this account's own Rental Pages. If
  // it's on a different owned page than the active one, send them back to
  // the fleet list rather than error, it's not missing, just out of scope here.
  const ownedPageIds = new Set(pages.map((p) => p.id));
  if (!ownedPageIds.has(vehicle.agency_id)) notFound();
  if (vehicle.agency_id !== agency.id) redirect("/dashboard/vehicles");

  const { data: docData } = await supabase
    .from("vehicle_documents")
    .select("cr_url, insurance_url, revenue_license_url")
    .eq("vehicle_id", id)
    .maybeSingle();
  const documents = (docData ?? null) as { cr_url: string | null; insurance_url: string | null; revenue_license_url: string | null } | null;

  return (
    <div>
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to fleet
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Edit {vehicle.year} {vehicle.make} {vehicle.model}
      </h1>
      <p className="text-slate-600 text-sm mb-8">
        Important listing changes may need a new DriveLink review before renters see them.
      </p>

      {canEdit
        ? <VehicleForm
            agencyId={agency.id}
            agencyCity={agency.city}
            vehicle={vehicle}
            documents={documents}
            canDeclareListingAuthority={pageAccess.capabilities.includes("declare_listing_authority")}
          />
        : <AgencyVerificationGate ownerKycVerified={ownerKycVerified} />}
    </div>
  );
}
