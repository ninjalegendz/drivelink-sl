import { notFound } from "next/navigation";
import { AlertTriangle, Car, User, Plane, ShieldCheck, Star, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { HelpHint } from "@/components/ui/HelpHint";
import { BookingRequestForm } from "@/components/booking/BookingRequestForm";
import { VehicleGallery } from "@/components/vehicles/VehicleGallery";
import { formatLKR, insuranceLabel, fuelPolicyLabel, reliabilityColor, reliabilityLabel, responseTimeLabel, RELIABILITY_HELP, RATING_HELP, REVIEW_COUNT_HELP } from "@/lib/vehicles/format";
import { vehicleTypeLabel, usdFromLkr, BADGE_DESCRIPTIONS } from "@/data/vehicles";
import { presetIcon } from "@/data/vehicle-presets";
import { siteConfig } from "@/lib/site-config";
import { providerNoun, providerNounCap } from "@/lib/providers/label";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";

const INSURANCE_HELP =
  "Hire Insurance: vehicle is licensed for commercial rental, fully covered if anything goes wrong. " +
  "Private (P-Number): owner's personal insurance, may not cover rental usage. Always verify with the agency.";

const FUEL_POLICY_HELP =
  "Full-to-Full: pick up with a full tank, return with a full tank. " +
  "Same-to-Same: return at whatever fuel level you received it.";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("make, model, year, city, daily_rate_lkr")
    .eq("slug", slug)
    .single();

  const v = data as { make: string; model: string; year: number; city: string; daily_rate_lkr: number } | null;
  if (!v) return { title: "Vehicle not found" };

  return {
    title: `Rent ${v.year} ${v.make} ${v.model} in ${v.city}`,
    description: `Rent a ${v.year} ${v.make} ${v.model} in ${v.city} from ${formatLKR(v.daily_rate_lkr)}/day. Verified provider, zero platform fee via DriveLink SL.`,
  };
}

export default async function VehicleDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("vehicles")
    .select("*, agencies(id, owner_id, name, city, provider_type, is_verified, reliability_pct, cancellation_count, avg_response_minutes, profiles!owner_id(rating_avg, rating_count))")
    .eq("slug", slug)
    .single();

  if (!data) notFound();

  const vehicle = data as unknown as VehicleWithAgency;
  const agency = vehicle.agencies!;
  const ownerId = (agency as { owner_id?: string }).owner_id;
  // Renter-facing word for this provider: "host" (individual) or "agency".
  const provNoun = providerNoun(agency.provider_type);
  const provNounCap = providerNounCap(agency.provider_type);

  // How many rentals this agency has actually completed, gates the public
  // reliability % so a brand-new agency doesn't flash a misleading 100%/0%.
  const { count: completedRentals } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency.id)
    .eq("status", "completed");
  const rentalsDone = completedRentals ?? 0;

  // Guest reviews of this provider (renters review the agency owner after a trip).
  const { data: reviewRows } = ownerId
    ? await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)")
        .eq("reviewee_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: null };
  const reviews = (reviewRows ?? []) as unknown as {
    id: string; rating: number; comment: string | null; created_at: string;
    reviewer: { full_name: string } | null;
  }[];
  const photos = vehicle.photos ?? [];
  const usd = usdFromLkr(vehicle.daily_rate_lkr, vehicle.daily_rate_usd);
  const badges = vehicle.badges ?? [];
  const rules = vehicle.rules ?? [];

  const rentalOptions = [
    vehicle.self_drive && { label: "Self-Drive", Icon: Car },
    vehicle.with_driver && { label: "With Driver", Icon: User },
    vehicle.airport_pickup && { label: "Airport Pickup", Icon: Plane },
  ].filter(Boolean) as { label: string; Icon: typeof Car }[];

  // Fetch already-blocked date ranges so the booking form can warn renters
  // upfront. Two sources: in-flight bookings + agency-managed vehicle_blocks.
  const todayIso = new Date().toISOString().split("T")[0];
  const [{ data: bookedRows }, { data: blockRows }] = await Promise.all([
    supabase
      .from("bookings")
      .select("start_at, end_at")
      .eq("vehicle_id", vehicle.id)
      .in("status", ["requested", "pending_confirmation", "confirmed", "payment_pending", "active", "disputed"])
      .gte("end_date", todayIso)
      .order("start_at", { ascending: true }),
    supabase
      .from("vehicle_blocks")
      .select("start_date, end_date")
      .eq("vehicle_id", vehicle.id)
      .gte("end_date", todayIso),
  ]);

  const bookedRanges = [
    ...(bookedRows ?? []).map((r) => ({ start: (r as { start_at: string }).start_at, end: (r as { end_at: string }).end_at })),
    // Maintenance blocks are whole-day, represent at day boundaries.
    ...(blockRows ?? []).map((r) => ({ start: `${(r as { start_date: string }).start_date}T00:00`, end: `${(r as { end_date: string }).end_date}T00:00` })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {vehicle.status === "pending_review" && (
        <div className="mb-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>Admin preview</strong>, this listing is pending review and is not visible to the public yet.</span>
        </div>
      )}
      <div className="grid lg:grid-cols-5 gap-8">

        {/* Left: photos + details */}
        <div className="lg:col-span-3 space-y-6">

          <VehicleGallery photos={photos} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />

          {/* Title + price */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
              <span className="uppercase tracking-wider">{vehicle.make}</span>
              <span>·</span><span>{vehicle.year}</span>
              <span>·</span><span>{vehicleTypeLabel(vehicle.vehicle_type)}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <p className="text-slate-600 mt-0.5">{vehicle.city}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-extrabold text-blue-600">{formatLKR(vehicle.daily_rate_lkr)}</p>
                <p className="text-slate-500 text-xs">per day{siteConfig.showUsd ? ` (~$${usd})` : ""}</p>
                {vehicle.monthly_rate_lkr && (
                  <p className="text-emerald-600 text-xs mt-1 font-medium">or {formatLKR(vehicle.monthly_rate_lkr)} / month</p>
                )}
              </div>
            </div>
            {vehicle.deposit_lkr > 0 && (
              <p className="text-slate-600 text-sm mt-1">+ {formatLKR(vehicle.deposit_lkr)} refundable deposit</p>
            )}

            {/* Rental option chips */}
            {rentalOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {rentalOptions.map(({ label, Icon }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Driving requirements (F1/F3), the make-or-break info for tourists */}
          {(vehicle.self_drive || vehicle.with_driver) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-1.5">
              <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <Info size={15} className="text-blue-600" /> Driving in Sri Lanka
              </p>
              {vehicle.self_drive && (
                <p className="text-slate-600 text-xs leading-relaxed">
                  <strong className="text-slate-800">Self-drive:</strong> visitors need an International Driving Permit (IDP)
                  carried with your home licence, or a Sri Lankan recognition permit. We check your licence before pickup,
                  many owners can help arrange the permit.
                </p>
              )}
              {vehicle.with_driver && (
                <p className="text-slate-600 text-xs leading-relaxed">
                  <strong className="text-slate-800">With a driver:</strong> no licence or IDP needed, a professional local
                  driver handles everything.
                </p>
              )}
            </div>
          )}

          {/* Trust badges */}
          {badges.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => <VerificationBadge key={b} label={b} />)}
              </div>
              {badges.some((b) => BADGE_DESCRIPTIONS[b]) && (
                <details className="text-xs">
                  <summary className="text-slate-500 hover:text-blue-600 cursor-pointer select-none inline-flex items-center gap-1">
                    <Info size={12} /> What these badges mean
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-0.5">
                    {badges.filter((b) => BADGE_DESCRIPTIONS[b]).map((b) => (
                      <li key={b} className="text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-800">{b}:</span> {BADGE_DESCRIPTIONS[b]}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Transmission", value: vehicle.transmission },
              { label: "Seats",        value: `${vehicle.seats} seats` },
              ...(vehicle.fuel_type   ? [{ label: "Fuel type", value: vehicle.fuel_type }] : []),
              ...(vehicle.luggage != null ? [{ label: "Luggage", value: `${vehicle.luggage} bag${vehicle.luggage === 1 ? "" : "s"}` }] : []),
              { label: "Fuel Policy",  value: fuelPolicyLabel(vehicle.fuel_policy), help: FUEL_POLICY_HELP },
              { label: "Insurance",    value: insuranceLabel(vehicle.insurance_type), help: INSURANCE_HELP },
            ] as { label: string; value: string; help?: string }[]).map(({ label, value, help }) => (
              <div key={label} className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-slate-500 text-xs flex items-center">
                  {label}{help && <HelpHint text={help} />}
                </p>
                <p className="text-slate-900 text-sm font-medium mt-0.5 capitalize">{value}</p>
              </div>
            ))}
          </div>

          {/* Rental rules & limits */}
          {(vehicle.mileage_limit || vehicle.extra_mileage_lkr || vehicle.deposit_lkr > 0) && (
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800 text-sm">Rental handover rules & limits</h3>
              <div className="text-xs">
                {vehicle.deposit_lkr > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Refundable deposit</span>
                    <span className="font-bold text-slate-700">{formatLKR(vehicle.deposit_lkr)}</span>
                  </div>
                )}
                {vehicle.mileage_limit && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Mileage allowance</span>
                    <span className="font-bold text-slate-700">{vehicle.mileage_limit}</span>
                  </div>
                )}
                {vehicle.extra_mileage_lkr ? (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Extra mileage fee</span>
                    <span className="font-bold text-slate-700">{formatLKR(vehicle.extra_mileage_lkr)}/km</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Description */}
          {vehicle.description && (
            <div>
              <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-2">About this vehicle</p>
              <p className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">{vehicle.description}</p>
            </div>
          )}

          {/* Handover requirements (rules array) */}
          {rules.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800 text-sm">Handover requirements</h3>
              <ul className="space-y-2">
                {rules.map((rule, i) => {
                  const RuleIcon = presetIcon(rule);
                  return (
                    <li key={i} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
                      <RuleIcon className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" /><span>{rule}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Insurance warning */}
          {vehicle.insurance_type === "private" && (
            <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                This vehicle has Private (P-Number) insurance. Verify coverage with the {provNoun} before renting.
              </p>
            </div>
          )}

          {/* Features */}
          {vehicle.features && vehicle.features.length > 0 && (
            <div>
              <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-2">Features</p>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((f: string) => {
                  const FeatIcon = presetIcon(f);
                  return (
                    <Badge key={f} variant="slate">
                      <span className="inline-flex items-center gap-1"><FeatIcon className="w-3 h-3" />{f}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Guest reviews */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Guest reviews</h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No reviews yet, be the first to rent and review this {provNoun}.</p>
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
        </div>

        {/* Right: provider + booking */}
        <div className="lg:col-span-2 space-y-4">

          {/* Provider card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{provNounCap === "Host" ? "Vehicle host" : "Registered agency"}</p>
                <p className="font-semibold text-slate-900">{agency.name}</p>
                <p className="text-slate-600 text-xs mt-0.5">{agency.city}</p>
                {responseTimeLabel(agency.avg_response_minutes) && (
                  <p className="text-emerald-600 text-[11px] font-medium mt-0.5">Typically replies in {responseTimeLabel(agency.avg_response_minutes)}</p>
                )}
              </div>
              {agency.is_verified && <Badge variant="green">Verified</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={`text-lg font-bold ${reliabilityColor(agency.reliability_pct, rentalsDone)}`}>{reliabilityLabel(agency.reliability_pct, rentalsDone)}</p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">Reliability <HelpHint text={RELIABILITY_HELP} /></p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{agency.profiles?.rating_avg ? agency.profiles.rating_avg.toFixed(1) : "-"}</p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">Rating <HelpHint text={RATING_HELP} /></p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{agency.profiles?.rating_count ?? 0}</p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">Reviews <HelpHint text={REVIEW_COUNT_HELP} /></p>
              </div>
            </div>
          </div>

          {/* Booking card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-1">Send booking inquiry</h2>
            <p className="text-slate-600 text-xs mb-4">
              {siteConfig.freeLaunch ? "No fees, no down payment. " : ""}The {provNoun} confirms availability, then their contact unlocks.
            </p>
            <BookingRequestForm
              vehicleId={vehicle.id}
              agencyId={vehicle.agency_id}
              vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              dailyRateLkr={vehicle.daily_rate_lkr}
              monthlyRateLkr={vehicle.monthly_rate_lkr}
              bookedRanges={bookedRanges}
              listingPath={`/vehicles/${vehicle.slug}`}
            />
          </div>

          {/* How it works */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest mb-3">How it works</p>
            <ol className="space-y-2">
              {[
                "You send a booking request, free, no payment",
                "DriveLink verifies your details (licence for self-drive)",
                `The ${provNoun} confirms availability`,
                `${provNounCap} contact unlocks so you can sync the handover`,
                `Pickup & return, pay the ${provNoun} directly`,
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
