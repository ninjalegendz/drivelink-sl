"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { X, MapPin, Star, Car, User, Plane, ShieldCheck, Check, ExternalLink, Zap, CalendarX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VehicleGallery } from "@/components/vehicles/VehicleGallery";
import { BookingRequestForm, type DateRange } from "@/components/booking/BookingRequestForm";
import { formatLKR, insuranceLabel, fuelPolicyLabel, responseTimeLabel } from "@/lib/vehicles/format";
import { badgeDisplayLabel, vehicleTypeLabel, usdFromLkr } from "@/data/vehicles";
import { siteConfig } from "@/lib/site-config";
import type { VehicleWithAgency } from "@/types/queries";
import { trackTrafficEvent } from "@/lib/analytics/client";
import { isCurrentVerifiedVehicle } from "@/lib/vehicles/trust";

type ModalReview = {
  id: string; rating: number; comment: string | null; created_at: string;
  reviewer: { full_name: string } | null;
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "DL";
}

export function VehicleDetailModal({ vehicle, onClose }: { vehicle: VehicleWithAgency; onClose: () => void }) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const agency = vehicle.agencies;
  // BUILD 2: page rating, not the owner's personal rating.
  const rating = agency?.rating_avg ?? null;
  const reviewCount = agency?.rating_count ?? 0;
  const usd = usdFromLkr(vehicle.daily_rate_lkr, vehicle.daily_rate_usd);
  const badges = vehicle.badges ?? [];
  const rules = vehicle.rules ?? [];
  const responseLabel = responseTimeLabel(agency?.avg_response_minutes);
  const fastResponder = badges.includes("Fast Response");
  const currentlyVerified = isCurrentVerifiedVehicle(vehicle);

  const rentalOptions = [
    vehicle.self_drive && { label: "Self-Drive", Icon: Car },
    vehicle.with_driver && { label: "With Driver", Icon: User },
    vehicle.airport_pickup && { label: "Airport Handover", Icon: Plane },
  ].filter(Boolean) as { label: string; Icon: typeof Car }[];

  const [bookedRanges, setBookedRanges] = useState<DateRange[]>([]);
  const [reviews, setReviews] = useState<ModalReview[]>([]);

  // Body scroll lock + Esc to close
  useEffect(() => {
    trackTrafficEvent({
      event: "vehicle_view",
      entityType: "vehicle",
      entityId: vehicle.id,
      label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    });
    const prev = document.body.style.overflow;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      returnFocus?.focus();
    };
  }, [onClose, vehicle.id, vehicle.make, vehicle.model, vehicle.year]);

  // Booked / blocked ranges for the date picker warning.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // BOOK-009: privacy-safe availability RPC - works for signed-out visitors
      // (a direct bookings read returns nothing under party-only RLS for anon).
      const { data: avail } = await supabase.rpc("vehicle_availability", { p_vehicle_id: vehicle.id });
      if (cancelled) return;
      const ranges = ((avail ?? []) as { start_date: string; end_date: string }[])
        .map((r) => ({ start: `${r.start_date}T00:00`, end: `${r.end_date}T00:00` }))
        .sort((a, b) => a.start.localeCompare(b.start));
      setBookedRanges(ranges);
    })();
    return () => { cancelled = true; };
  }, [vehicle.id]);

  // Reviews of this Rental Page (BUILD 2: page reviews, not the owner's).
  useEffect(() => {
    const agencyId = agency?.id;
    if (!agencyId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(6);
      if (!cancelled) setReviews((data ?? []) as unknown as ModalReview[]);
    })();
    return () => { cancelled = true; };
  }, [agency?.id]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-md md:flex md:items-center md:justify-center md:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100dvh] w-full max-w-4xl animate-bounce-in flex-col overflow-y-auto bg-white shadow-2xl md:h-auto md:max-h-[92vh] md:flex-row md:overflow-hidden md:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="fixed right-3 top-[max(.75rem,env(safe-area-inset-top))] z-[60] grid h-11 w-11 place-items-center rounded-md border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur hover:bg-slate-100 md:absolute md:top-3"
          aria-label="Close vehicle details"
        >
          <X className="h-5 w-5" />
        </button>
        {/* Left: details */}
        <div className="md:w-1/2 md:overflow-y-auto p-6 md:p-7 space-y-5 border-b md:border-b-0 md:border-r border-slate-100 md:max-h-[92vh]">
          <VehicleGallery photos={vehicle.photos ?? []} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
              <MapPin className="w-3.5 h-3.5 text-blue-500" /> {vehicle.city}
              <span>·</span><span>{vehicle.make}</span>
              <span>·</span><span>{vehicleTypeLabel(vehicle.vehicle_type)}</span>
            </div>
            <h2 id={titleId} className="font-display text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <div className="flex items-center gap-1 mt-1.5 text-xs font-bold text-slate-700">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              {rating ? `${rating.toFixed(1)} (${reviewCount} verified reviews)` : "Newly listed"}
            </div>
          </div>

          {/* Rental options */}
          {rentalOptions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rentalOptions.map(({ label, Icon }) => (
                <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </span>
              ))}
            </div>
          )}

          {/* Trust badges */}
          {(badges.length > 0 || currentlyVerified) && (
            <div className="flex flex-wrap gap-1.5">
              {currentlyVerified && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified Vehicle
                </span>
              )}
              {badges.map((b) => (
                <span key={b} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                  <ShieldCheck className="w-2.5 h-2.5 text-blue-500" /> {badgeDisplayLabel(b)}
                </span>
              ))}
            </div>
          )}
          {!currentlyVerified && (
            <div className="space-y-1.5">
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">Basic listing</span>
              <p className="text-xs leading-5 text-slate-600">The Rental Page declared its right to list this vehicle, and DriveLink reviewed the public listing. The vehicle documents have not completed Verified Vehicle review. Confirm the exact vehicle and insurance conditions before handover.</p>
            </div>
          )}
          {currentlyVerified && (
            <p className="text-xs leading-5 text-slate-600">DriveLink reviewed the uploaded registration, hire-insurance, and revenue-licence documents for this listing. This is not a guarantee of insurance cover.</p>
          )}

          {/* Specs */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl">
            <Spec label="Transmission" value={vehicle.transmission} />
            <Spec label="Seats" value={`${vehicle.seats} persons`} />
            {vehicle.fuel_type && <Spec label="Fuel type" value={vehicle.fuel_type} />}
            {vehicle.luggage != null && <Spec label="Luggage" value={`${vehicle.luggage} bag${vehicle.luggage === 1 ? "" : "s"}`} />}
            <Spec label="Fuel policy" value={fuelPolicyLabel(vehicle.fuel_policy)} />
            <Spec label="Insurance" value={insuranceLabel(vehicle.insurance_type)} />
          </div>

          {/* Rules & limits */}
          {(vehicle.mileage_limit || vehicle.extra_mileage_lkr || vehicle.deposit_lkr > 0) && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-sm">Rental handover rules &amp; limits</h4>
              <div className="text-xs">
                <Row
                  label="Refundable deposit"
                  value={vehicle.deposit_lkr > 0
                    ? `${formatLKR(vehicle.deposit_lkr)}${siteConfig.showUsd ? ` (~$${usdFromLkr(vehicle.deposit_lkr)})` : ""}`
                    : "No deposit needed"}
                />
                {vehicle.mileage_limit && <Row label="Mileage allowance" value={vehicle.mileage_limit} />}
                {vehicle.extra_mileage_lkr ? <Row label="Extra mileage fee" value={`${formatLKR(vehicle.extra_mileage_lkr)}/km`} /> : null}
              </div>
            </div>
          )}

          {/* Registered host */}
          {agency && (
            <div className="p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {initials(agency.name)}
                </span>
                <div>
                  <p className="text-xs text-slate-400 font-semibold">Registered host</p>
                  <h4 className="text-xs font-bold text-slate-800">{agency.name}</h4>
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-bold mt-0.5">
                    {agency.is_verified && <span className="text-blue-600">Verified</span>}
                    {agency.is_verified && (responseLabel || fastResponder) && <span>·</span>}
                    {responseLabel
                      ? <span className="inline-flex items-center gap-0.5 text-emerald-600"><Zap className="w-2.5 h-2.5" /> Replies {responseLabel}</span>
                      : fastResponder && <span className="inline-flex items-center gap-0.5 text-emerald-600"><Zap className="w-2.5 h-2.5" /> Replies fast</span>}
                  </div>
                </div>
              </div>
              {rating != null && (
                <div className="text-right">
                  <p className="text-sm font-extrabold text-slate-800 flex items-center gap-0.5 justify-end">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {rating.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-400">{reviewCount} reviews</p>
                </div>
              )}
            </div>
          )}

          {/* Handover requirements */}
          {rules.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-sm">Handover requirements</h4>
              <ul className="space-y-2">
                {rules.map((rule, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" /><span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Guest reviews */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-sm">Guest reviews</h4>
            {reviews.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No reviews yet, be the first to rent and review this provider.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div key={rev.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">{rev.reviewer?.full_name ?? "Verified renter"}</span>
                      <span className="text-xs text-slate-400">{new Date(rev.created_at).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" })}</span>
                    </div>
                    <div className="flex text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                    </div>
                    {rev.comment && <p className="text-xs text-slate-600 italic leading-normal">&ldquo;{rev.comment}&rdquo;</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href={`/vehicles/${vehicle.slug}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
            Open full page <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Right: booking */}
        <div className="md:w-1/2 md:overflow-y-auto p-6 md:p-7 bg-slate-50/50 md:max-h-[92vh]">
          <div className="flex items-center justify-between mb-1 pr-12">
            <h3 className="font-bold text-slate-900 text-lg">Send booking inquiry</h3>
          </div>

          {/* The card that opened this modal was greyed out, so say why here
              too rather than presenting a form that cannot succeed on those
              dates. The form stays usable: other dates may well be free. */}
          {(vehicle.booked_in_range || vehicle.blocked_in_range) && (
            <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              <CalendarX size={16} className="mt-1 shrink-0" />
              <span>
                {vehicle.blocked_in_range
                  ? "The provider has marked your selected dates unavailable."
                  : "This vehicle is already booked for your selected dates."}
                {" "}Pick different dates below to request it.
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-xl font-extrabold text-blue-600">{formatLKR(vehicle.daily_rate_lkr)}</span>
            <span className="text-xs text-slate-400">/ day{siteConfig.showUsd ? ` (~$${usd})` : ""}</span>
          </div>

          <BookingRequestForm
            vehicleId={vehicle.id}
            agencyId={vehicle.agency_id}
            vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            dailyRateLkr={vehicle.daily_rate_lkr}
            weeklyRateLkr={vehicle.weekly_rate_lkr}
            monthlyRateLkr={vehicle.monthly_rate_lkr}
            selfDrive={vehicle.self_drive}
            withDriver={vehicle.with_driver}
            deliveryAvailable={vehicle.delivery_available}
            deliveryFeeLkr={vehicle.delivery_fee_lkr}
            perKmRateLkr={vehicle.per_km_rate_lkr}
            driverBataLkr={vehicle.driver_bata_lkr}
            bookedRanges={bookedRanges}
          />
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-xs font-bold text-slate-700 capitalize">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  );
}
