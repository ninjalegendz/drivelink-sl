import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site-config";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
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

  const { page } = await getActivePage(supabase, user.id);

  if (!page) redirect("/account/pages/new");
  const agency  = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("manage_fleet")) redirect("/dashboard");
  const service = await createServiceClient();
  const { data: profileData } = await service.from("profiles").select("kyc_status").eq("id", agency.owner_id).single();
  const profile = profileData as { kyc_status: string } | null;

  const ownerKycVerified = profile?.kyc_status === "verified";
  const canList          = ownerKycVerified;
  const canDeclare       = pageAccess.capabilities.includes("declare_listing_authority");

  // Duplicating an existing listing? Seed the wizard from it (own fleet only;
  // photos/docs/plate are per-vehicle so they are not copied).
  let prefill: WizardPrefill | null = null;
  if (from && canList) {
    const { data: src } = await supabase
      .from("vehicles")
      .select([
        "make, model, year, vehicle_type, daily_rate_lkr, deposit_lkr",
        "self_drive, with_driver, airport_pickup, transmission, seats, fuel_type, city",
        "insurance_type, mileage_limit, rules, features, description",
        "body_type, variant, doors, engine_cc",
        "weekly_rate_lkr, included_km_per_day, unlimited_km, extra_mileage_lkr",
        "delivery_available, delivery_fee_lkr, min_rental_days, max_rental_days",
        "cleaning_fee_lkr, refuel_fee_lkr, late_fee_per_hour_lkr",
        "smoking_allowed, pets_allowed, ride_hail_allowed, restricted_use",
        "min_renter_age, min_license_years, has_gps_tracker, has_etc_tag",
        "per_km_rate_lkr, tolls_included, driver_bata_lkr",
      ].join(", "))
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
        Three quick steps. Listing is free.
      </p>

      {/* "List it for me": for owners who would rather send photos than fill in
          a form. The team drafts it on this page and the owner confirms it. */}
      {canList && !prefill && canDeclare && (
        <a
          href={whatsappLink(`Hi DriveLink, please list my vehicle for me. Rental Page: ${agency.name} (${agency.id.slice(0, 8).toUpperCase()})`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 flex max-w-xl items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <MessageCircle size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Short on time? We can list it for you</span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-600">
              Send the photos, plate number and daily price on WhatsApp. Our team sets up the listing and you just check it and confirm.
            </span>
          </span>
        </a>
      )}

      {prefill && (
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-medium">
          <Copy size={13} /> Duplicated from {prefill.year} {prefill.make} {prefill.model}. Add fresh photos, the plate number and the odometer. Everything else is pre-filled.
        </div>
      )}

      {canList
        ? <VehicleWizard
            agencyId={agency.id}
            agencyCity={agency.city}
            prefill={prefill}
            canDeclareListingAuthority={canDeclare}
          />
        : <AgencyVerificationGate ownerKycVerified={ownerKycVerified} />}
    </div>
  );
}
