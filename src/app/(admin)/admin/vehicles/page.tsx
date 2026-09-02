import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { Car, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { VehicleApprovalActions } from "@/components/admin/VehicleApprovalActions";
import { VehicleBadgeEditor } from "@/components/admin/VehicleBadgeEditor";
import { VehicleFeatureToggle } from "@/components/admin/VehicleFeatureToggle";
import { VehicleVerificationToggle } from "@/components/admin/VehicleVerificationToggle";
import { formatLKR, insuranceLabel, fuelPolicyLabel } from "@/lib/vehicles/format";
import type { Database } from "@/types/database";
import { hasCurrentVehicleCompliance, listingPublicationProblem } from "@/lib/vehicles/trust";

type VehicleRow  = Database["public"]["Tables"]["vehicles"]["Row"];
type AgencyLite  = { name: string; city: string; whatsapp_number: string };

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const FILTER_TABS = [
  { label: "Pending review", value: "pending_review" },
  { label: "Live",           value: "available" },
  { label: "Unlisted",       value: "unlisted" },
  { label: "All",            value: "all" },
] as const;

export default async function AdminVehiclesPage({ searchParams }: Props) {
  const { status: filterParam } = await searchParams;
  // Default to pending_review when no filter is in the URL
  const activeFilter = filterParam ?? "pending_review";

  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, agencies(name, city, whatsapp_number)")
    .order("created_at", { ascending: false });

  if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data } = await query.limit(60);
  const vehicles = (data ?? []) as unknown as (VehicleRow & { agencies: AgencyLite | null })[];

  // Document proof (CR / insurance) for the document check, admin-only.
  const ids = vehicles.map((v) => v.id);
  const { data: docRows } = ids.length
    ? await supabase.from("vehicle_documents").select("vehicle_id, cr_url, insurance_url, revenue_license_url").in("vehicle_id", ids)
    : { data: [] };
  const docMap = new Map(
    ((docRows ?? []) as { vehicle_id: string; cr_url: string | null; insurance_url: string | null; revenue_license_url: string | null }[]).map((d) => [d.vehicle_id, d]),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Vehicle Listings</h1>
      <p className="text-slate-600 text-sm mb-6">
        Approve new listings before they go live on the marketplace.
      </p>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl p-1 w-fit max-w-full">
        {FILTER_TABS.map(({ label, value }) => (
          <a
            key={value}
            href={`/admin/vehicles?status=${value}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeFilter === value
                ? "bg-slate-200 text-slate-900 font-medium"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center">
          <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-400" />
          <p className="text-slate-600 text-sm">
            {activeFilter === "pending_review" ? "No vehicles waiting for review." : "No vehicles match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) => {
            const photos = v.photos ?? [];

            // Compact card for vehicles that have already been reviewed once.
            // Full review detail only matters for pending_review.
            if (v.status !== "pending_review") {
              const cover = photos[0];
              return (
                <div key={v.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                  {/* Header: photo + title + price (kept compact so the rest can span full width below) */}
                  <div className="flex gap-3">
                    <div className="relative w-20 h-16 sm:w-28 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                      {cover ? (
                        <Image src={cover} alt={`${v.year} ${v.make} ${v.model}`} fill className="object-cover" sizes="112px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Car size={24} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{v.year} {v.make} {v.model}</p>
                        <p className="text-slate-600 text-xs mt-0.5">
                          {v.agencies?.name ?? "-"} · {v.city}
                        </p>
                      </div>
                      <p className="text-blue-600 font-bold text-sm shrink-0 text-right">
                        {formatLKR(v.daily_rate_lkr)}<span className="text-slate-500 text-xs font-normal"> / day</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions + badges span the full card width (no photo indent) */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/vehicles/${v.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500"
                    >
                      Preview <ExternalLink size={11} />
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <VehicleFeatureToggle vehicleId={v.id} initial={v.is_featured ?? false} />
                      <VehicleApprovalActions
                        vehicleId={v.id}
                        status={v.status}
                        approvalProblem={listingPublicationProblem(v, { approvalClearsRejection: true })}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <VehicleBadgeEditor vehicleId={v.id} initialBadges={v.badges ?? []} />
                  </div>
                  <div className="mt-3">
                    <VehicleVerificationToggle
                      vehicleId={v.id}
                      initial={v.verified_vehicle}
                      eligible={hasCurrentVehicleCompliance(v) && Boolean(docMap.get(v.id)?.cr_url && docMap.get(v.id)?.insurance_url && docMap.get(v.id)?.revenue_license_url)}
                    />
                  </div>
                </div>
              );
            }

            // Full review card, only for pending_review.
            return (
              <div key={v.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">

                {/* Header: title, agency, price, actions */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-lg">
                        {v.year} {v.make} {v.model}
                      </p>
                      <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>
                        {insuranceLabel(v.insurance_type)}
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-sm mt-1">
                      {v.agencies?.name ?? "-"} · {v.city} · {v.agencies?.whatsapp_number ?? "-"}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5 font-mono">
                      Submitted {new Date(v.created_at).toLocaleString("en-LK")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-blue-600 font-bold">{formatLKR(v.daily_rate_lkr)}<span className="text-slate-500 text-xs font-normal"> / day</span></p>
                    {v.monthly_rate_lkr && (
                      <p className="text-emerald-700 text-xs mt-0.5">{formatLKR(v.monthly_rate_lkr)} / month</p>
                    )}
                    {v.deposit_lkr > 0 && (
                      <p className="text-slate-500 text-xs mt-0.5">+ {formatLKR(v.deposit_lkr)} deposit</p>
                    )}
                  </div>
                </div>

                {/* All photos */}
                {photos.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                    {photos.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-44 h-28 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 hover:border-blue-500 transition-colors group"
                      >
                        <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="176px" />
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 text-xs bg-blue-600 text-white font-semibold px-1.5 py-0.5 rounded">Cover</span>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-0.5 rounded transition-opacity inline-flex items-center gap-1">
                            View <ExternalLink size={10} />
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-100/70 border border-slate-200 rounded-lg p-4 mb-4 flex items-center gap-3 text-slate-500 text-sm">
                    <Car size={20} strokeWidth={1.5} />
                    No photos uploaded yet.
                  </div>
                )}

                {/* Spec grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Transmission", value: v.transmission },
                    { label: "Seats",        value: `${v.seats}` },
                    { label: "Fuel policy",  value: fuelPolicyLabel(v.fuel_policy) },
                    { label: "Color",        value: v.color || "-" },
                    { label: "Plate",        value: v.plate_number || "-" },
                    { label: "Photos",       value: photos.length || "0" },
                    { label: "Status",       value: v.status },
                    { label: "Slug",         value: v.slug, mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
                      <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
                      <p className={`text-slate-900 text-xs mt-0.5 ${mono ? "font-mono truncate" : ""}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {v.description && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Description</p>
                    <p className="text-slate-700 text-sm whitespace-pre-line leading-relaxed bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
                      {v.description}
                    </p>
                  </div>
                )}

                {/* Features */}
                {v.features && v.features.length > 0 && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Features ({v.features.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.features.map((f) => <Badge key={f} variant="slate">{f}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Recorded authority declaration */}
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-slate-500 text-xs uppercase tracking-wider">Right to list</p>
                  {v.listing_authority_declared && v.listing_authority_confirmed_at ? (
                    <>
                      <p className="mt-1 text-xs font-semibold text-slate-900">
                        {v.listing_authority_basis === "registered_owner" ? "Page operator says it owns the vehicle" : "Page operator says the registered owner authorised it"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Self-declared on {new Date(v.listing_authority_confirmed_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}. Compare the plate and any submitted CR; ask for written authority when the operator is not the registered owner.</p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-amber-700">No recorded right-to-list declaration. Do not publish.</p>
                  )}
                </div>

                {/* Document proof */}
                <div className="mb-3">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Document proof</p>
                  {(() => {
                    const docs = docMap.get(v.id);
                    if (!docs || (!docs.cr_url && !docs.insurance_url)) {
                      return <p className="text-amber-600 text-xs">No documents uploaded yet, request CR + insurance before awarding “Documents Checked”.</p>;
                    }
                    return (
                      <div className="flex flex-wrap gap-2">
                        {docs.cr_url && (
                          <a href={docs.cr_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                            Registration (CR) <ExternalLink size={11} />
                          </a>
                        )}
                        {docs.insurance_url && (
                          <a href={docs.insurance_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                            Insurance <ExternalLink size={11} />
                          </a>
                        )}
                        {docs.revenue_license_url && (
                          <a href={docs.revenue_license_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                            Revenue licence <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    );
                  })()}
                  <p className="mt-2 text-xs leading-5 text-slate-600">Verified Vehicle review requires registration, hire insurance, and a revenue licence.</p>
                </div>

                {/* Badge assignment */}
                <div className="mb-3">
                  <VehicleBadgeEditor vehicleId={v.id} initialBadges={v.badges ?? []} />
                </div>
                <div className="mb-3">
                  <VehicleVerificationToggle
                    vehicleId={v.id}
                    initial={v.verified_vehicle}
                    eligible={hasCurrentVehicleCompliance(v) && Boolean(docMap.get(v.id)?.cr_url && docMap.get(v.id)?.insurance_url && docMap.get(v.id)?.revenue_license_url)}
                  />
                </div>

                {/* Actions row */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/vehicles/${v.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500"
                  >
                    Open public preview <ExternalLink size={11} />
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <VehicleFeatureToggle vehicleId={v.id} initial={v.is_featured ?? false} />
                  <VehicleApprovalActions
                    vehicleId={v.id}
                    status={v.status}
                    approvalProblem={listingPublicationProblem(v, { approvalClearsRejection: true })}
                  />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
