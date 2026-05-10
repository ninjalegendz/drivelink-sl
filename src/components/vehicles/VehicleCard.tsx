import Link from "next/link";
import Image from "next/image";
import { Car, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, insuranceLabel, reliabilityColor } from "@/lib/vehicles/format";
import type { VehicleWithAgency } from "@/types/queries";

export function VehicleCard({ vehicle }: { vehicle: VehicleWithAgency }) {
  const photo = vehicle.photos?.[0];
  const agency = vehicle.agencies;

  return (
    <Link
      href={`/vehicles/${vehicle.slug}`}
      className="group block bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors"
    >
      {/* Photo */}
      <div className="relative aspect-[16/9] bg-slate-800">
        {photo ? (
          <Image
            src={photo}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700">
            <Car size={48} strokeWidth={1.5} />
          </div>
        )}

        {/* Insurance badge — critical for SL renters */}
        <div className="absolute top-2 right-2">
          <Badge variant={vehicle.insurance_type === "hire" ? "green" : "yellow"}>
            {insuranceLabel(vehicle.insurance_type)}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white text-sm">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">{vehicle.city}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-amber-400 font-bold text-sm">{formatLKR(vehicle.daily_rate_lkr)}</p>
            <p className="text-slate-500 text-xs">/ day</p>
          </div>
        </div>

        {/* Features row */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant="slate">{vehicle.transmission}</Badge>
          <Badge variant="slate">{vehicle.seats} seats</Badge>
          {vehicle.features?.slice(0, 2).map((f) => (
            <Badge key={f} variant="slate">{f}</Badge>
          ))}
        </div>

        {/* Agency row */}
        {agency && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <p className="text-slate-400 text-xs truncate">{agency.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              {agency.rating_avg && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Star size={12} fill="currentColor" className="text-amber-400" />
                  {agency.rating_avg.toFixed(1)}
                </span>
              )}
              {agency.reliability_pct !== null && (
                <span className={`text-xs font-medium ${reliabilityColor(agency.reliability_pct)}`}>
                  {agency.reliability_pct}% reliable
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
