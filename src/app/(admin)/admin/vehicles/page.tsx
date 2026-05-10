import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { Car, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { VehicleApprovalActions } from "@/components/admin/VehicleApprovalActions";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
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
  { label: "All",            value: "" },
];

export default async function AdminVehiclesPage({ searchParams }: Props) {
  const { status: filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, agencies(name, city, whatsapp_number)")
    .order("created_at", { ascending: false });

  if (filter) {
    query = query.eq("status", filter);
  } else {
    // default = pending review at top
    query = query.eq("status", "pending_review");
  }

  const { data } = await query.limit(60);
  const vehicles = (data ?? []) as unknown as (VehicleRow & { agencies: AgencyLite | null })[];

  const activeFilter = filter ?? "pending_review";

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
            href={value ? `/admin/vehicles?status=${value}` : "/admin/vehicles?status=all"}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeFilter === value || (activeFilter === "pending_review" && value === "pending_review")
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
        <div className="space-y-3">
          {vehicles.map((v) => {
            const photo = v.photos?.[0];
            return (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex gap-4">
                  {/* Photo */}
                  <div className="relative w-32 h-24 shrink-0 rounded-lg overflow-hidden bg-slate-800">
                    {photo ? (
                      <Image src={photo} alt="" fill className="object-cover" sizes="128px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <Car size={28} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          {v.year} {v.make} {v.model}
                        </p>
                        <p className="text-slate-400 text-sm mt-0.5">{v.city}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {v.agencies?.name ?? "—"} · {v.agencies?.whatsapp_number ?? "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-amber-400 font-bold text-sm">{formatLKR(v.daily_rate_lkr)}</p>
                        <p className="text-slate-500 text-xs">/ day</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>
                        {insuranceLabel(v.insurance_type)}
                      </Badge>
                      <Badge variant="slate">{v.transmission}</Badge>
                      <Badge variant="slate">{v.seats} seats</Badge>
                      {v.photos?.length && (
                        <Badge variant="slate">{v.photos.length} photo{v.photos.length === 1 ? "" : "s"}</Badge>
                      )}
                    </div>

                    {v.description && (
                      <p className="text-slate-400 text-xs mt-2 line-clamp-2">{v.description}</p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Link
                        href={`/vehicles/${v.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                      >
                        Preview <ExternalLink size={11} />
                      </Link>
                      {v.status === "pending_review" && (
                        <VehicleApprovalActions vehicleId={v.id} />
                      )}
                      {v.status !== "pending_review" && (
                        <Badge variant={v.status === "available" ? "green" : v.status === "unlisted" ? "red" : "slate"}>
                          {v.status}
                        </Badge>
                      )}
                    </div>
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
