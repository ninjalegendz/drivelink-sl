import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, Car, User, Plane, ShieldCheck, Star, Info,
  Gauge, Route, Truck, Droplets, Fuel, Clock, Cigarette, CigaretteOff, PawPrint,
  CarTaxiFront, Users, Ban, IdCard, Satellite, Ticket, Banknote, Moon,
  type LucideIcon,
} from "lucide-react";
import { createPublicClient } from "@/lib/supabase/server";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { HelpHint } from "@/components/ui/HelpHint";
import { BookingRequestForm } from "@/components/booking/BookingRequestForm";
import { ReportListingButton } from "@/components/vehicles/ReportListingButton";
import { VehicleViewTracker } from "@/components/vehicles/VehicleViewTracker";
import { isCurrentVerifiedVehicle } from "@/lib/vehicles/trust";
import { VehicleGallery } from "@/components/vehicles/VehicleGallery";
import { formatLKR, insuranceLabel, fuelPolicyLabel, reliabilityColor, reliabilityLabel, responseTimeLabel, RELIABILITY_HELP, RATING_HELP, REVIEW_COUNT_HELP } from "@/lib/vehicles/format";
import { badgeDisplayLabel, vehicleTypeLabel, usdFromLkr, BADGE_DESCRIPTIONS } from "@/data/vehicles";
import { presetIcon, restrictedUseLabel } from "@/data/vehicle-presets";
import { siteConfig } from "@/lib/site-config";
import { providerNoun, providerNounCap } from "@/lib/providers/label";
import { PUBLIC_VEHICLE_WITH_AGENCY_SELECT } from "@/lib/vehicles/public-query";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";
import { pageShellClass } from "@/components/ui/PageShell";
import { ActionBar } from "@/components/ui/ActionBar";
import { Explanation } from "@/components/ui/Explanation";
import { HouseRules } from "@/components/vehicles/HouseRules";

const INSURANCE_HELP =
  "Hire insurance: the provider states this vehicle is insured for rental use. Policies can still have an excess, exclusions and driver conditions. " +
  "Private insurance: a personal policy may not cover paid rental use. Confirm the relevant cover with the provider before driving.";

const FUEL_POLICY_HELP =
  "Full-to-Full: pick up with a full tank, return with a full tank. " +
  "Same-to-Same: return at whatever fuel level you received it.";

interface Props {
  params: Promise<{ slug: string }>;
  // Carried over from the search form so the renter is not asked for their
  // dates a second time on the page they landed on to book.
  searchParams?: Promise<{ from?: string; to?: string; from_time?: string; to_time?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("vehicles")
    .select("make, model, year, city, daily_rate_lkr")
    .eq("slug", slug)
    .single();

  const v = data as { make: string; model: string; year: number; city: string; daily_rate_lkr: number } | null;
  if (!v) return { title: "Vehicle not found" };

  return {
    title: `Rent ${v.year} ${v.make} ${v.model} in ${v.city}`,
    description: `Rent a ${v.year} ${v.make} ${v.model} in ${v.city} from ${formatLKR(v.daily_rate_lkr)}/day. DriveLink booking request fee is Rs. 0.`,
  };
}

export default async function VehicleDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from, to, from_time, to_time } = (await searchParams) ?? {};
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select(PUBLIC_VEHICLE_WITH_AGENCY_SELECT)
    .eq("slug", slug)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error("Public vehicle detail lookup failed.", { cause: error });
  }
  if (!data) notFound();

  const vehicle = data as unknown as VehicleWithAgency;
  const agency = vehicle.agencies!;
  // Renter-facing word for this provider: "host" (individual) or "Rental Page".
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

  // Reviews of this Rental Page (renters review the PAGE after a trip - BUILD 2).
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false })
    .limit(8);
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
    vehicle.airport_pickup && { label: "Airport Handover", Icon: Plane },
  ].filter(Boolean) as { label: string; Icon: typeof Car }[];

  // ── Rental terms panel (Terms Engine). Rows with nothing to say are
  // omitted entirely, no placeholders. Legacy listings that only have the
  // free-text mileage_limit still get a mileage line. ──
  const kmText = vehicle.unlimited_km
    ? "Unlimited kilometres"
    : vehicle.included_km_per_day != null
      ? `${vehicle.included_km_per_day} km/day included`
      : vehicle.mileage_limit
        ? (/unlimited/i.test(vehicle.mileage_limit) ? "Unlimited kilometres" : `${vehicle.mileage_limit} included`)
        : null;

  const includedRows: TermItem[] = [
    ...(kmText ? [{ Icon: Gauge, text: kmText }] : []),
    ...(!vehicle.unlimited_km && vehicle.extra_mileage_lkr
      ? [{ Icon: Route, text: `${formatLKR(vehicle.extra_mileage_lkr)}/extra km beyond the allowance` }] : []),
    ...(vehicle.delivery_available
      ? [{ Icon: Truck, text: vehicle.delivery_fee_lkr ? `Delivery available: ${formatLKR(vehicle.delivery_fee_lkr)}` : "Delivery available" }] : []),
    ...(vehicle.airport_pickup ? [{ Icon: Plane, text: "Airport handover available" }] : []),
  ];

  // Deposit is deliberately not repeated here, it already shows under the price.
  const feeRows: TermItem[] = [
    ...(vehicle.cleaning_fee_lkr > 0
      ? [{ Icon: Droplets, text: `${formatLKR(vehicle.cleaning_fee_lkr)} cleaning fee, only if returned excessively dirty` }] : []),
    ...(vehicle.refuel_fee_lkr > 0
      ? [{ Icon: Fuel, text: `${formatLKR(vehicle.refuel_fee_lkr)} refuel service fee if returned with less fuel` }] : []),
    ...(vehicle.late_fee_per_hour_lkr
      ? [{ Icon: Clock, text: `Late return: ${formatLKR(vehicle.late_fee_per_hour_lkr)}/hour after a 2-hour grace period` }]
      : []),
  ];

  const ruleChips: TermItem[] = [
    vehicle.smoking_allowed ? { Icon: Cigarette, text: "Smoking OK" } : { Icon: CigaretteOff, text: "No smoking" },
    { Icon: PawPrint, text: vehicle.pets_allowed ? "Pets OK" : "No pets" },
    { Icon: CarTaxiFront, text: vehicle.ride_hail_allowed ? "Ride-hail use OK" : "No ride-hail use" },
    ...(vehicle.self_drive ? [{ Icon: Users, text: "Verified account holder is the only renter-driver" }] : []),
  ];

  const restrictedText = (vehicle.restricted_use ?? []).length > 0
    ? `Not allowed: ${vehicle.restricted_use.map(restrictedUseLabel).join(", ")}`
    : null;

  // Age / licence requirements only matter when the renter drives.
  const requirementText = vehicle.self_drive
    ? `Driver ${vehicle.min_renter_age}+${vehicle.min_license_years > 0 ? `, licence held ${vehicle.min_license_years}+ years` : ""}`
    : null;

  const disclosureRows: TermItem[] = [
    ...(vehicle.has_gps_tracker ? [{ Icon: Satellite, text: "GPS tracker fitted (disclosed here before you request)" }] : []),
    ...(vehicle.has_etc_tag ? [{ Icon: Ticket, text: "Expressway ETC tag fitted: toll charges during your rental are yours" }] : []),
  ];

  const withDriverRows: TermItem[] = vehicle.with_driver
    ? [
        ...(vehicle.per_km_rate_lkr ? [{ Icon: Route, text: `${formatLKR(vehicle.per_km_rate_lkr)}/km with driver` }] : []),
        ...(vehicle.tolls_included === true
          ? [{ Icon: Banknote, text: "Tolls included in the price" }]
          : vehicle.tolls_included === false
            ? [{ Icon: Banknote, text: "Tolls paid by you at the booth" }]
            : []),
        ...(vehicle.driver_bata_lkr
          ? [{ Icon: Moon, text: `Driver overnight allowance ${formatLKR(vehicle.driver_bata_lkr)}/night on multi-day trips` }] : []),
      ]
    : [];

  // Blocked date ranges for the calendar. BOOK-009: use the privacy-safe
  // vehicle_availability RPC (committed bookings + maintenance blocks, dates
  // only) so SIGNED-OUT visitors see accurate availability too - a direct
  // bookings read returns nothing under party-only RLS for anon.
  const { data: availRows } = await supabase.rpc("vehicle_availability", { p_vehicle_id: vehicle.id });
  const bookedRanges = ((availRows ?? []) as { start_date: string; end_date: string }[])
    .map((r) => ({ start: `${r.start_date}T00:00`, end: `${r.end_date}T00:00` }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const currentlyVerified = isCurrentVerifiedVehicle(vehicle);
  // RLS is what decides who may open this page at all; anyone who gets here on
  // a non-published listing is an owner, a staff member or an admin, and needs
  // to be told plainly that this is not what the public sees.
  const isLive = vehicle.status === "available" || vehicle.status === "rented";

  return (
    <div className={pageShellClass("standard")}>
      <VehicleViewTracker vehicleId={vehicle.id} label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
      {!isLive && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          <AlertTriangle size={16} className="mt-1 shrink-0" />
          <span>
            <strong>Preview only.</strong>{" "}
            {vehicle.status === "pending_review"
              ? "This listing is waiting for DriveLink review. It is not in search and cannot take bookings yet."
              : "This listing is not published, so it is not in search and cannot take bookings. Only people who can manage it can open this page."}
          </span>
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
            {/* The deposit is routinely two to three times the daily rate, and
                it is the number people actually weigh before deciding. Shown at
                the same weight as the price, with who holds it, because meeting
                it late reads as concealment even when nothing was concealed. */}
            {vehicle.deposit_lkr > 0 && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-base font-semibold text-slate-900">
                    {formatLKR(vehicle.deposit_lkr)} refundable deposit
                  </p>
                  <p className="text-sm text-slate-600">paid to the {provNoun}, not to DriveLink</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Handed over at pickup and returned after the vehicle is checked back in.
                  DriveLink does not hold it, and records the condition at both ends so the
                  amount returned can be settled against evidence.
                </p>
                {/* The deposit is the number that decides it, and it is the one
                    people most need in their own language. */}
                <Explanation explanation="deposit" className="mt-3" />
              </div>
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
                  <strong className="text-slate-800">Self-drive:</strong> add your licence and permit details before requesting.
                  The Rental Page checks the original documents at pickup. Driving and insurance requirements can depend on
                  your licence, permit and the provider&apos;s policy, so confirm them before travelling.
                </p>
              )}
              {vehicle.with_driver && (
                <p className="text-slate-600 text-xs leading-relaxed">
                  <strong className="text-slate-800">With a driver:</strong> you do not drive the vehicle. Confirm the named
                  driver, licence, working hours, route limits and extra charges before handover.
                </p>
              )}
            </div>
          )}

          {/* Trust badges */}
          {(badges.length > 0 || currentlyVerified) && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {currentlyVerified && <VerificationBadge label="Verified Vehicle" />}
                {badges.map((b) => <VerificationBadge key={b} label={badgeDisplayLabel(b)} />)}
              </div>
              {currentlyVerified && (
                <p className="text-xs leading-5 text-slate-600">DriveLink reviewed the uploaded registration, hire-insurance, and revenue-licence documents for this listing. This is not a guarantee of insurance cover.</p>
              )}
              {badges.some((b) => BADGE_DESCRIPTIONS[b]) && (
                <details className="text-xs">
                  <summary className="text-slate-500 hover:text-blue-600 cursor-pointer select-none inline-flex items-center gap-1">
                    <Info size={12} /> What these badges mean
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-0.5">
                    {badges.filter((b) => BADGE_DESCRIPTIONS[b]).map((b) => (
                      <li key={b} className="text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-800">{badgeDisplayLabel(b)}:</span> {BADGE_DESCRIPTIONS[b]}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {!currentlyVerified && (
            <div className="space-y-1.5">
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">Basic listing</span>
              <p className="text-xs leading-5 text-slate-600">The Rental Page declared its right to list this vehicle, and DriveLink reviewed the public listing. The vehicle documents have not completed Verified Vehicle review. Confirm the exact vehicle and insurance conditions before handover.</p>
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

          {/* Description */}
          {vehicle.description && (
            <div>
              <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-2">About this vehicle</p>
              <p className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">{vehicle.description}</p>
            </div>
          )}

          {/* Handover requirements: the twelve standard rules translate, a
              host's own wording is shown as theirs. */}
          <HouseRules rules={rules} />

          {/* Insurance warning */}
          {vehicle.insurance_type === "private" && (
            <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                This vehicle has Private (P-Number) insurance. Verify coverage with the {provNoun} before renting.
              </p>
            </div>
          )}

          {/* TRUST-023: insurance expiry awareness */}
          {vehicle.insurance_expiry && new Date(vehicle.insurance_expiry as string) < new Date() && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={18} className="text-rose-700 shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">
                The insurance on file for this vehicle shows as expired ({new Date(vehicle.insurance_expiry as string).toLocaleDateString("en-LK")}).
                Confirm current, valid coverage with the {provNoun} before you drive.
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

          {/* Rental terms: trust panel (Terms Engine) */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-blue-600" /> Rental terms
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                No surprise charges: these are the terms your request is sent on.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {includedRows.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">What&apos;s included</p>
                  <TermRows rows={includedRows} />
                </div>
              )}
              {feeRows.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">Fees you should know</p>
                  <TermRows rows={feeRows} />
                </div>
              )}
            </div>

            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">House rules</p>
              <div className="flex flex-wrap gap-1.5">
                {ruleChips.map(({ Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
                    <Icon className="w-3 h-3 text-blue-500" /> {text}
                  </span>
                ))}
              </div>
              {(restrictedText || requirementText) && (
                <div className="mt-2">
                  <TermRows
                    rows={[
                      ...(restrictedText ? [{ Icon: Ban, text: restrictedText }] : []),
                      ...(requirementText ? [{ Icon: IdCard, text: requirementText }] : []),
                    ]}
                  />
                </div>
              )}
            </div>

            {disclosureRows.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">Disclosures</p>
                <TermRows rows={disclosureRows} />
              </div>
            )}

            {withDriverRows.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">With driver</p>
                <TermRows rows={withDriverRows} />
              </div>
            )}
          </div>

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
        </div>

        {/* Right: provider + booking */}
        <div className="lg:col-span-2 space-y-4">

          {/* Provider card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{provNounCap === "Host" ? "Vehicle host" : "Rental Page"}</p>
                {(agency as { slug?: string | null }).slug ? (
                  <Link href={`/pages/${(agency as { slug?: string | null }).slug}`} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline">{agency.name}</Link>
                ) : (
                  <p className="font-semibold text-slate-900">{agency.name}</p>
                )}
                <p className="text-slate-600 text-xs mt-0.5">{agency.city}</p>
                {responseTimeLabel(agency.avg_response_minutes) && (
                  <p className="text-emerald-600 text-xs font-medium mt-0.5">Typically replies in {responseTimeLabel(agency.avg_response_minutes)}</p>
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
                <p className="text-lg font-bold text-slate-900">{agency.rating_avg ? Number(agency.rating_avg).toFixed(1) : "-"}</p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">Rating <HelpHint text={RATING_HELP} /></p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{agency.rating_count ?? 0}</p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">Reviews <HelpHint text={REVIEW_COUNT_HELP} /></p>
              </div>
            </div>
          </div>

          {/* Booking card. "Send booking inquiry" read as something short of
              entering the booking flow, so the brief replaces it with the
              action plus the exact next state underneath. */}
          <div id="request" className="scroll-mt-20 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            {!isLive ? (
              <>
                <h2 className="font-semibold text-slate-900 mb-1">Not accepting bookings</h2>
                <p className="text-slate-600 text-sm">
                  {vehicle.status === "pending_review"
                    ? "Once DriveLink approves this listing, the request form appears here and renters can send dates."
                    : "This listing is not published. Publish it from your fleet to start receiving booking requests."}
                </p>
              </>
            ) : (
            <>
            <h2 className="font-semibold text-slate-900 mb-1">Request this vehicle</h2>
            <p className="text-slate-600 text-sm mb-1">
              The {provNoun} will review your dates.
            </p>
            <p className="text-slate-600 text-xs mb-4">
              DriveLink&apos;s booking confirmation fee is Rs. 0. Once they confirm availability, their contact unlocks.
            </p>
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
              initialStartDate={from ?? null}
              initialEndDate={to ?? null}
              initialStartTime={from_time ?? null}
              initialEndTime={to_time ?? null}
            />
            </>
            )}
            <div className="mt-2 text-right">
              <ReportListingButton vehicleId={vehicle.id} />
            </div>
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

      {/* Thumb-reachable action for the whole listing. This page is long on a
          phone, and without it the only way to act is to remember where the
          request card was and scroll back to it. Desktop returns it to normal
          flow, where the request card is already visible beside the content. */}
      <ActionBar
        summary={
          <span>
            <strong className="text-slate-900">{formatLKR(vehicle.daily_rate_lkr)}</strong> per day
            {vehicle.deposit_lkr ? ` · ${formatLKR(vehicle.deposit_lkr)} refundable deposit` : ""}
          </span>
        }
      >
        <a
          href="#request"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Choose dates
        </a>
      </ActionBar>
    </div>
  );
}

// ─── Rental terms panel bits ─────────────────────────────────

type TermItem = { Icon: LucideIcon; text: string };

function TermRows({ rows }: { rows: TermItem[] }) {
  return (
    <ul className="space-y-1.5">
      {rows.map(({ Icon, text }) => (
        <li key={text} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
          <Icon className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" /><span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
