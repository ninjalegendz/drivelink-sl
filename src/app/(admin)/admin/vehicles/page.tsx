import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { Car, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { VehicleApprovalActions } from "@/components/admin/VehicleApprovalActions";
import { formatLKR, insuranceLabel, fuelPolicyLabel } from "@/lib/vehicles/format";
import type { Database } from "@/types/database";

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Vehicle Listings</h1>
      <p className="text-slate-400 text-sm mb-6">
        Approve new listings before they go live on the marketplace.
      </p>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit">
        {FILTER_TABS.map(({ label, value }) => (
          <a
            key={value}
            href={`/admin/vehicles?status=${value}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeFilter === value
                ? "bg-slate-700 text-white font-medium"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm">
            {activeFilter === "pending_review" ? "No vehicles waiting for review." : "No vehicles match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) => {
            const photos = v.photos ?? [];
            return (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">

                {/* Header: title, agency, price, actions */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-lg">
                        {v.year} {v.make} {v.model}
                      </p>
                      <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>
                        {insuranceLabel(v.insurance_type)}
                      </Badge>
                      {v.status !== "pending_review" && v.status !== "available" && v.status !== "unlisted" && (
                        <Badge variant="slate">{v.status}</Badge>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                      {v.agencies?.name ?? "—"} · {v.city} · {v.agencies?.whatsapp_number ?? "—"}
                    </p>
                    <p className="text-slate-600 text-xs mt-0.5 font-mono">
                      Submitted {new Date(v.created_at).toLocaleString("en-LK")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-400 font-bold">{formatLKR(v.daily_rate_lkr)}<span className="text-slate-500 text-xs font-normal"> / day</span></p>
                    {v.monthly_rate_lkr && (
                      <p className="text-emerald-400 text-xs mt-0.5">{formatLKR(v.monthly_rate_lkr)} / month</p>
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
                        className="relative w-44 h-28 shrink-0 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 hover:border-amber-500 transition-colors group"
                      >
                        <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="176px" />
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 text-[10px] bg-amber-500 text-slate-950 font-semibold px-1.5 py-0.5 rounded">Cover</span>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] bg-black/60 px-2 py-0.5 rounded transition-opacity inline-flex items-center gap-1">
                            View <ExternalLink size={10} />
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4 flex items-center gap-3 text-slate-500 text-sm">
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
                    { label: "Color",        value: v.color || "—" },
                    { label: "Plate",        value: v.plate_number || "—" },
                    { label: "Photos",       value: photos.length || "0" },
                    { label: "Status",       value: v.status },
                    { label: "Slug",         value: v.slug, mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
                      <p className={`text-white text-xs mt-0.5 ${mono ? "font-mono truncate" : ""}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {v.description && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Description</p>
                    <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
                      {v.description}
                    </p>
                  </div>
                )}

                {/* Features */}
                {v.features && v.features.length > 0 && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5">Features ({v.features.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.features.map((f) => <Badge key={f} variant="slate">{f}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Actions row */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <Link
                    href={`/vehicles/${v.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                  >
                    Open public preview <ExternalLink size={11} />
                  </Link>
                  {(v.status === "pending_review" || v.status === "available" || v.status === "unlisted") && (
                    <VehicleApprovalActions vehicleId={v.id} status={v.status} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
