import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Car, Plus, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { VehicleStatusToggle } from "@/components/dashboard/VehicleStatusToggle";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

const STATUS_VARIANT = {
  available:      "green",
  rented:         "yellow",
  maintenance:    "slate",
  unlisted:       "red",
  pending_review: "blue",
} as const;

const STATUS_LABEL = {
  available:      "Listed",
  rented:         "Rented",
  maintenance:    "Maintenance",
  unlisted:       "Unlisted",
  pending_review: "Pending review",
} as const;

export default async function FleetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/vehicles");

  const { data: agencyData } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!agencyData) redirect("/signup?intent=provider");
  const agency = agencyData as { id: string };

  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  const vehicles = (data ?? []) as VehicleRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fleet</h1>
          <p className="text-slate-600 text-sm mt-0.5">
            {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/dashboard/vehicles/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <Plus size={16} /> Add vehicle
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center">
          <Car size={48} strokeWidth={1.5} className="mx-auto mb-3 text-slate-400" />
          <h2 className="text-slate-900 font-semibold mb-1">No vehicles yet</h2>
          <p className="text-slate-600 text-sm mb-6">
            Add your first vehicle to start receiving booking requests.
          </p>
          <Link
            href="/dashboard/vehicles/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <Plus size={16} /> Add your first vehicle
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map((v) => {
            const photo = v.photos?.[0];
            return (
              <div
                key={v.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[16/9] bg-slate-100">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={`${v.year} ${v.make} ${v.model}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Car size={40} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={STATUS_VARIANT[v.status]}>
                      {STATUS_LABEL[v.status]}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">
                        {v.year} {v.make} {v.model}
                      </h3>
                      <p className="text-slate-600 text-xs mt-0.5">{v.city}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-blue-600 font-bold text-sm">
                        {formatLKR(v.daily_rate_lkr)}
                      </p>
                      <p className="text-slate-500 text-xs">/ day</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge variant="slate">{v.transmission}</Badge>
                    <Badge variant="slate">{v.seats} seats</Badge>
                    <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>
                      {insuranceLabel(v.insurance_type)}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-0.5 -ml-2">
                      <Link
                        href={`/dashboard/vehicles/${v.id}/edit`}
                        className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/vehicles/${v.id}/availability`}
                        className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Availability
                      </Link>
                      <Link
                        href={`/dashboard/vehicles/new?from=${v.id}`}
                        title="Start a new listing pre-filled from this one"
                        className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Duplicate
                      </Link>
                      <Link
                        href={`/vehicles/${v.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        View <ExternalLink size={11} />
                      </Link>
                    </div>
                    <VehicleStatusToggle vehicleId={v.id} status={v.status} />
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
