"use client";

import Link from "next/link";
import Image from "next/image";
import { Car, Star, MapPin, Users, Settings2, ShieldCheck, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import { vehicleTypeLabel, usdFromLkr } from "@/data/vehicles";
import { siteConfig } from "@/lib/site-config";
import type { VehicleWithAgency } from "@/types/queries";

interface Props {
  vehicle: VehicleWithAgency;
  /** When provided, a normal click opens this in a modal instead of navigating.
      The underlying href is preserved for SEO, middle-click, and right-click. */
  onOpen?: (vehicle: VehicleWithAgency) => void;
}

export function VehicleCard({ vehicle, onOpen }: Props) {
  const photo = vehicle.photos?.[0];
  const agency = vehicle.agencies;
  const rating = agency?.profiles?.rating_avg ?? null;
  const reviews = agency?.profiles?.rating_count ?? 0;
  const usd = usdFromLkr(vehicle.daily_rate_lkr, vehicle.daily_rate_usd);
  const badges = vehicle.badges ?? [];
  const href = `/vehicles/${vehicle.slug}`;

  const cardClass =
    "spring-hover group flex flex-col bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm text-left";

  const inner = (
    <>
      {/* Photo */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden">
        {photo ? (
          <Image
            src={photo}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            fill
            // Served straight from R2/CDN (no Worker resizing), photos are
            // already downscaled at upload, so this avoids per-image Worker CPU
            // across the high-volume card grid.
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car size={48} strokeWidth={1.5} />
          </div>
        )}

        {/* Featured ribbon */}
        {vehicle.is_featured && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" /> Featured
          </div>
        )}

        {/* Location chip */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md flex items-center gap-1">
          <MapPin className="w-3 h-3 text-blue-400" /> {vehicle.city}
        </div>

        {/* Rental-option corner badges */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 items-end">
          {vehicle.self_drive && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white shadow-sm">Self-Drive</span>
          )}
          {vehicle.with_driver && (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-slate-950 shadow-sm">With Driver</span>
          )}
        </div>

        {/* Insurance badge, critical for SL renters */}
        <div className="absolute top-3 right-3">
          <Badge variant={vehicle.insurance_type === "hire" ? "green" : "yellow"}>
            {insuranceLabel(vehicle.insurance_type)}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-0.5 text-amber-400">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="font-bold text-slate-800">{rating ? rating.toFixed(1) : "New"}</span>
            </span>
            {reviews > 0 && (<><span>·</span><span>{reviews} reviews</span></>)}
          </div>

          <h3 className="font-bold text-slate-800 mt-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>

          <div className="flex items-center gap-3 text-slate-400 text-xs mt-2 font-medium">
            <span className="flex items-center gap-1 capitalize"><Settings2 className="w-3.5 h-3.5" /> {vehicle.transmission}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {vehicle.seats} seats</span>
            <span>·</span>
            <span>{vehicleTypeLabel(vehicle.vehicle_type)}</span>
          </div>
        </div>

        {/* Trust badges preview */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {badges.slice(0, 3).map((b) => (
              <span key={b} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
                <ShieldCheck className="w-2.5 h-2.5 text-blue-500" /> {b}
              </span>
            ))}
            {badges.length > 3 && (
              <span className="px-1 py-0.5 rounded bg-slate-50 text-slate-400 text-[9px] font-bold">+{badges.length - 3} more</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Daily rate</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-slate-800">{formatLKR(vehicle.daily_rate_lkr)}</span>
              {siteConfig.showUsd && <span className="text-xs text-slate-400 font-normal">(~${usd})</span>}
            </div>
          </div>
          <span className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </>
  );

  // No modal handler → plain client-side link to the detail page.
  if (!onOpen) {
    return <Link href={href} className={cardClass}>{inner}</Link>;
  }

  // Modal mode: keep the real href (SEO, middle/right-click, open-in-new-tab)
  // but intercept a plain left-click to open the in-app modal.
  return (
    <a
      href={href}
      className={cardClass}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(vehicle);
      }}
    >
      {inner}
    </a>
  );
}
