"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Car, Star, ShieldCheck, CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import { usdFromLkr } from "@/data/vehicles";
import { providerNounCap } from "@/lib/providers/label";
import { siteConfig } from "@/lib/site-config";
import type { VehicleWithAgency } from "@/types/queries";
import { isCurrentVerifiedVehicle } from "@/lib/vehicles/trust";

interface Props {
  vehicle: VehicleWithAgency;
  /** When provided, a normal click opens this in a modal instead of navigating.
      The underlying href is preserved for SEO, middle-click, and right-click. */
  onOpen?: (vehicle: VehicleWithAgency) => void;
}

/**
 * Up to 5 photos in a CSS scroll-snap strip. Swiping is native (touch scroll
 * + snap), the arrow buttons are a pointer-only convenience layered on top.
 * Both live inside the card's own <a>, so every control here has to stop the
 * click reaching that anchor or it would "click through" to navigation, or
 * to opening the modal, instead of just moving the carousel.
 */
function PhotoStrip({ photos, alt, dim }: { photos: string[]; alt: string; dim: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const shown = photos.slice(0, 5);

  const goTo = useCallback((next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(shown.length - 1, next));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    setIndex(clamped);
  }, [shown.length]);

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }

  function stopBubble(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (shown.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-300">
        <Car size={40} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {shown.map((photo, i) => (
          <div key={`${photo}-${i}`} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={photo}
              alt={i === 0 ? alt : `${alt}, photo ${i + 1} of ${shown.length}`}
              fill
              loading="lazy"
              className={`object-cover transition-transform duration-500 ${dim ? "opacity-45 saturate-50" : "group-hover/photo:scale-105"}`}
              // Cloudinary resizes these from the R2 original, so a card gets a
              // card-sized image instead of whatever the owner's phone produced.
              // sizes is what makes that work: without it every card would ask
              // for a full-viewport-width copy and most of the saving is lost.
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>

      {shown.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => { stopBubble(e); goTo(index - 1); }}
            className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 opacity-0 shadow-md transition-opacity duration-200 group-hover/photo:opacity-100 focus-visible:opacity-100 md:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => { stopBubble(e); goTo(index + 1); }}
            className="absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 opacity-0 shadow-md transition-opacity duration-200 group-hover/photo:opacity-100 focus-visible:opacity-100 md:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Position only, not a control: swipe or the arrows above move the
              strip, this just reflects where it landed. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1">
            {shown.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === index ? "w-3 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
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

  const agency = vehicle.agencies;
  const rating = agency?.rating_avg ?? null;
  const reviews = agency?.rating_count ?? 0;
  const usd = usdFromLkr(vehicle.daily_rate_lkr, vehicle.daily_rate_usd);
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

  const cardClass = "group/card flex flex-col text-left";

  const inner = (
    <>
      {/* Photo is the hero: full-bleed, rounded, no frame around the card
          itself. Everything overlaid on it must not swallow the card's own
          click, see PhotoStrip. */}
      <div className="group/photo relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/[0.06]">
        <PhotoStrip photos={vehicle.photos ?? []} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} dim={unavailable} />

        {/* Unavailable banner. Sits over the photo rather than beside the
            price, because the photo is what the eye lands on first in a grid. */}
        {unavailable && (
          <div className="glass-dark absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 px-3 py-2 text-white">
            <CalendarX className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="text-xs font-semibold leading-4">{unavailableReason}</span>
          </div>
        )}

        {/* Featured is an admin-curated promotion, not a status badge, so it
            keeps its own colour rather than borrowing the status palette. */}
        {vehicle.is_featured && (
          <div className={`absolute left-3 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow-sm ${unavailable ? "top-12" : "top-3"}`}>
            <Star className="h-3 w-3 fill-current" /> Featured
          </div>
        )}

        {/* Rental modes available on this listing. */}
        {(vehicle.self_drive || vehicle.with_driver) && (
          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1">
            {vehicle.self_drive && (
              <span className="glass-dark rounded-full px-2 py-0.5 text-xs font-semibold text-white">Self-drive</span>
            )}
            {vehicle.with_driver && (
              <span className="glass-dark rounded-full px-2 py-0.5 text-xs font-semibold text-white">With driver</span>
            )}
          </div>
        )}
      </div>

      {/* Content: tight typography, no card padding, the photo already did
          the separating. */}
      <div className="mt-3 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`line-clamp-1 text-base font-semibold transition-colors ${unavailable ? "text-slate-600" : "text-slate-900 group-hover/card:text-blue-700"}`}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-xs text-slate-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-900">{rating ? rating.toFixed(1) : "New"}</span>
            {reviews > 0 && <span className="text-slate-400">({reviews})</span>}
          </span>
        </div>

        <p className="mt-0.5 text-xs text-slate-500">
          {vehicle.city} <span aria-hidden="true">&middot;</span> <span className="capitalize">{vehicle.transmission}</span> <span aria-hidden="true">&middot;</span> {vehicle.seats} seats
        </p>

        {/* Three decision facts every renter needs before opening a listing:
            whether the vehicle itself is verified, whether insurance is
            declared, and who they would actually be dealing with. A separate
            trust-badge row used to sit below this; it folds in here instead
            so the card stays scannable in a dense grid. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {currentlyVerified ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Vehicle
            </span>
          ) : (
            <span className="font-medium text-slate-500">Basic listing</span>
          )}
          <span className="text-slate-300" aria-hidden="true">&middot;</span>
          <span className="text-slate-500">{insuranceLabel(vehicle.insurance_type)}</span>
          <span className="text-slate-300" aria-hidden="true">&middot;</span>
          <span className="text-slate-500">{providerNounCap(agency?.provider_type)}</span>
        </p>

        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="tabular text-lg font-bold text-slate-950">{formatLKR(vehicle.daily_rate_lkr)}</span>
          <span className="text-xs text-slate-500">/ day</span>
          {siteConfig.showUsd && <span className="text-xs text-slate-400">(~${usd})</span>}
          {unavailable && <span className="ml-auto text-xs font-semibold text-slate-500">See other dates</span>}
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
      // Opens the quick view in place, so the page-loading bar must not start.
      data-no-progress=""
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
