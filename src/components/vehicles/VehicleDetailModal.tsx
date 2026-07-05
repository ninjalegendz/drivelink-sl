"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, MapPin, Star, Car, User, Plane, ShieldCheck, Check, ExternalLink, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VehicleGallery } from "@/components/vehicles/VehicleGallery";
import { BookingRequestForm, type DateRange } from "@/components/booking/BookingRequestForm";
import { formatLKR, insuranceLabel, fuelPolicyLabel, responseTimeLabel } from "@/lib/vehicles/format";
import { vehicleTypeLabel, usdFromLkr } from "@/data/vehicles";
import { siteConfig } from "@/lib/site-config";
import type { VehicleWithAgency } from "@/types/queries";

const ACTIVE_BOOKING_STATUSES = ["requested", "pending_confirmation", "confirmed", "payment_pending", "active", "disputed"];

type ModalReview = {
  id: string; rating: number; comment: string | null; created_at: string;
  reviewer: { full_name: string } | null;
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "DL";
}

export function VehicleDetailModal({ vehicle, onClose }: { vehicle: VehicleWithAgency; onClose: () => void }) {
  const agency = vehicle.agencies;
  const rating = agency?.profiles?.rating_avg ?? null;
  const reviewCount = agency?.profiles?.rating_count ?? 0;
  const usd = usdFromLkr(vehicle.daily_rate_lkr, vehicle.daily_rate_usd);
  const badges = vehicle.badges ?? [];
  const rules = vehicle.rules ?? [];
  const responseLabel = responseTimeLabel(agency?.avg_response_minutes);
  const fastResponder = badges.includes("Fast Response");

  const rentalOptions = [
    vehicle.self_drive && { label: "Self-Drive", Icon: Car },
    vehicle.with_driver && { label: "With Driver", Icon: User },
    vehicle.airport_pickup && { label: "Airport Pickup", Icon: Plane },
  ].filter(Boolean) as { label: string; Icon: typeof Car }[];

  const [bookedRanges, setBookedRanges] = useState<DateRange[]>([]);
  const [reviews, setReviews] = useState<ModalReview[]>([]);

  // Body scroll lock + Esc to close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Booked / blocked ranges for the date picker warning.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const todayIso = new Date().toISOString().split("T")[0];
      const [{ data: booked }, { data: blocks }] = await Promise.all([
        supabase.from("bookings").select("start_at, end_at").eq("vehicle_id", vehicle.id).in("status", ACTIVE_BOOKING_STATUSES).gte("end_date", todayIso),
        supabase.from("vehicle_blocks").select("start_date, end_date").eq("vehicle_id", vehicle.id).gte("end_date", todayIso),
      ]);
      if (cancelled) return;
      const ranges = [
        ...((booked ?? []) as { start_at: string; end_at: string }[]).map((r) => ({ start: r.start_at, end: r.end_at })),
        ...((blocks ?? []) as { start_date: string; end_date: string }[]).map((r) => ({ start: `${r.start_date}T00:00`, end: `${r.end_date}T00:00` })),
      ].sort((a, b) => a.start.localeCompare(b.start));
      setBookedRanges(ranges);
    })();
    return () => { cancelled = true; };
  }, [vehicle.id]);

  // Guest reviews of this provider.
  useEffect(() => {
    const ownerId = agency?.owner_id;
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)")
        .eq("reviewee_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(6);
      if (!cancelled) setReviews((data ?? []) as unknown as ModalReview[]);
    })();
    return () => { cancelled = true; };
  }, [agency?.owner_id]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="animate-bounce-in bg-white rounded-2xl max-w-4xl w-full overflow-y-auto md:overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: details */}
        <div className="md:w-1/2 md:overflow-y-auto p-6 md:p-7 space-y-5 border-b md:border-b-0 md:border-r border-slate-100 md:max-h-[92vh]">
          <VehicleGallery photos={vehicle.photos ?? []} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
              <MapPin className="w-3.5 h-3.5 text-blue-500" /> {vehicle.city}
              <span>·</span><span>{vehicle.make}</span>
              <span>·</span><span>{vehicleTypeLabel(vehicle.vehicle_type)}</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
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
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
                  <ShieldCheck className="w-2.5 h-2.5 text-blue-500" /> {b}
                </span>
              ))}
            </div>
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
                  <p className="text-[10px] text-slate-400 font-semibold">Registered host</p>
                  <h4 className="text-xs font-bold text-slate-800">{agency.name}</h4>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mt-0.5">
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
                  <p className="text-[10px] text-slate-400">{reviewCount} reviews</p>
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
                      <span className="text-[10px] text-slate-400">{new Date(rev.created_at).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" })}</span>
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
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-slate-900 text-lg">Send booking inquiry</h3>
            <button onClick={onClose} className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-xl font-extrabold text-blue-600">{formatLKR(vehicle.daily_rate_lkr)}</span>
            <span className="text-xs text-slate-400">/ day{siteConfig.showUsd ? ` (~$${usd})` : ""}</span>
          </div>

          <BookingRequestForm
            vehicleId={vehicle.id}
            agencyId={vehicle.agency_id}
            vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            dailyRateLkr={vehicle.daily_rate_lkr}
            monthlyRateLkr={vehicle.monthly_rate_lkr}
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
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
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
