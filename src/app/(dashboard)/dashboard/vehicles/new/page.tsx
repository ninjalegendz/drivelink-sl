import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { VehicleWizard, type WizardPrefill } from "@/components/dashboard/VehicleWizard";
import { AgencyVerificationGate } from "@/components/dashboard/AgencyVerificationGate";

interface Props {
  searchParams: Promise<{ from?: string }>;
}

export default async function NewVehiclePage({ searchParams }: Props) {
  const { from } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/vehicles/new");

  const [{ data: agencyData }, { data: profileData }] = await Promise.all([
    supabase.from("agencies").select("id, city, is_verified").eq("owner_id", user.id).single(),
    supabase.from("profiles").select("kyc_status").eq("id", user.id).single(),
  ]);

  if (!agencyData) redirect("/signup?intent=provider");
  const agency  = agencyData  as { id: string; city: string; is_verified: boolean };
  const profile = profileData as { kyc_status: string } | null;

  const ownerKycVerified = profile?.kyc_status === "verified";
  const agencyApproved   = agency.is_verified;
  const canList          = ownerKycVerified && agencyApproved;

  // Duplicating an existing listing? Seed the wizard from it (own fleet only;
  // photos/docs/plate are per-vehicle so they are not copied).
  let prefill: WizardPrefill | null = null;
  if (from && canList) {
    const { data: src } = await supabase
      .from("vehicles")
      .select("make, model, year, vehicle_type, daily_rate_lkr, deposit_lkr, self_drive, with_driver, airport_pickup, transmission, seats, fuel_type, city, insurance_type, mileage_limit, rules, features, description")
      .eq("id", from)
      .eq("agency_id", agency.id)
      .single();
    prefill = (src as WizardPrefill | null) ?? null;
  }

  return (
    <div>
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to fleet
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">List your vehicle</h1>
      <p className="text-slate-600 text-sm mb-4">
        A few quick steps, we&apos;ll review it, then it goes live. Free during launch.
      </p>

      {prefill && (
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-medium">
          <Copy size={13} /> Duplicated from {prefill.year} {prefill.make} {prefill.model}. Add fresh photos, everything else is pre-filled.
        </div>
      )}

      {canList
        ? <VehicleWizard agencyId={agency.id} agencyCity={agency.city} prefill={prefill} />
        : <AgencyVerificationGate ownerKycVerified={ownerKycVerified} agencyApproved={agencyApproved} />}
    </div>
  );
}
