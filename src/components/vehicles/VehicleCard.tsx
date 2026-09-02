"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Car, Star, MapPin, Users, Settings2, ShieldCheck, ArrowRight, CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import { vehicleTypeLabel, usdFromLkr } from "@/data/vehicles";
import { siteConfig } from "@/lib/site-config";
import type { VehicleWithAgency } from "@/types/queries";
import { isCurrentVerifiedVehicle } from "@/lib/vehicles/trust";

interface Props {
  vehicle: VehicleWithAgency;
  /** When provided, a normal click opens this in a modal instead of navigating.
      The underlying href is preserved for SEO, middle-click, and right-click. */
  onOpen?: (vehicle: VehicleWithAgency) => void;
}

export function VehicleCard({ vehicle, onOpen }: Props) {
  // Carry the searched range onto the listing so the booking form opens on the
  // dates the renter already chose, instead of asking again.
  const search = useSearchParams();
  const carried = new URLSearchParams();
  for (const key of ["from", "to", "from_time", "to_time"]) {
    const value = search?.get(key);
    if (value) carried.set(key, value);
  }

  const photo = vehicle.photos?.[0];
  const agency = vehicle.agencies;
  const rating = agency?.rating_avg ?? null;
  const reviews = agency?.rating_count ?? 0;
  const usd = usdFromLkr(vehicle.daily_rate_lkr, vehicle.daily_rate_usd);
  const badges = vehicle.badges ?? [];
  const carriedQs = carried.toString();
  const href = carriedQs ? `/vehicles/${vehicle.slug}?${carriedQs}` : `/vehicles/${vehicle.slug}`;
  const currentlyVerified = isCurrentVerifiedVehicle(vehicle);

  // Set by search_vehicles() only when the search carried dates. The vehicle
  // stays in the results either way: removing it makes the fleet look like it
  // shrank for no reason, and the renter cannot tell "taken this week" from
  // "does not exist". Blocked and booked are worded differently because only
  // one of them is something the provider chose.
  const unavailable = Boolean(vehicle.booked_in_range || vehicle.blocked_in_range);
  const unavailableReason = vehicle.blocked_in_range
    ? "Provider has marked these dates unavailable"
    : "Already booked for your dates";

  const cardClass =
    `spring-hover group flex flex-col rounded-xl overflow-hidden border shadow-sm text-left ${
      unavailable ? "bg-slate-50 border-slate-200" : "bg-white border-slate-100"
    }`;

  const inner = (
    <>
      {/* Photo */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden">
        {photo ? (
          <Image
            src={photo}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            fill
            className={`object-cover transition-transform duration-500 ${
              unavailable ? "opacity-45 saturate-50" : "group-hover:scale-105"
            }`}
            // Cloudinary resizes these from the R2 original, so a card gets a
            // card-sized image instead of whatever the owner's phone produced.
            // sizes is what makes that work: without it every card would ask
            // for a full-viewport-width copy and most of the saving is lost.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car size={48} strokeWidth={1.5} />
          </div>
        )}

        {/* Unavailable banner. Sits over the photo rather than beside the
            price, because the photo is what the eye lands on first in a grid. */}
        {unavailable && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 bg-slate-900/85 px-3 py-2 text-white backdrop-blur-sm">
            <CalendarX className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="text-xs font-semibold leading-4">{unavailableReason}</span>
          </div>
        )}

        {/* Featured ribbon */}
        {vehicle.is_featured && (
          <div className={`absolute left-3 px-2 py-1 rounded-md text-xs font-extrabold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1 ${unavailable ? "top-12" : "top-3"}`}>
            <Star className="w-3 h-3 fill-current" /> Featured
          </div>
        )}

        {/* Location chip */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-xs font-bold bg-slate-900/80 text-white backdrop-blur-md flex items-center gap-1">
          <MapPin className="w-3 h-3 text-blue-400" /> {vehicle.city}
        </div>

        {/* Rental-option corner badges */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 items-end">
          {vehicle.self_drive && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white shadow-sm">Self-Drive</span>
          )}
          {vehicle.with_driver && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-slate-950 shadow-sm">With Driver</span>
          )}
        </div>

        {/* Insurance badge, critical for SL renters */}
        <div className={`absolute right-3 ${unavailable ? "top-12" : "top-3"}`}>
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

          <h3 className={`font-bold mt-1 line-clamp-1 transition-colors ${unavailable ? "text-slate-600" : "text-slate-800 group-hover:text-blue-600"}`}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>

          {currentlyVerified && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3 w-3" /> Verified Vehicle
            </span>
          )}
          {!currentlyVerified && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              Basic listing
            </span>
          )}

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
              <span key={b} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                <ShieldCheck className="w-2.5 h-2.5 text-blue-500" /> {b}
              </span>
            ))}
            {badges.length > 3 && (
              <span className="px-1 py-0.5 rounded bg-slate-50 text-slate-400 text-xs font-bold">+{badges.length - 3} more</span>
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
          {unavailable ? (
            <span className="text-xs font-semibold text-slate-600">See other dates</span>
          ) : (
            <span className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
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
