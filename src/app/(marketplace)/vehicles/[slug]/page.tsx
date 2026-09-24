import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, Car, User, Plane, ShieldCheck, Star, Info,
  Gauge, Route, Truck, Droplets, Fuel, Clock, Cigarette, CigaretteOff, PawPrint,
  CarTaxiFront, Users, Ban, IdCard, Satellite, Ticket, Banknote, Moon, Settings2, Luggage,
  type LucideIcon,
} from "lucide-react";
import { createPublicClient, createClient, createServiceClient } from "@/lib/supabase/server";
import { getActingPages } from "@/lib/pages/active-page";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { HelpHint } from "@/components/ui/HelpHint";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
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
import { isDemoMode, demoVehicleBySlug } from "@/lib/demo/fixtures";

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

  const v = (data ?? (isDemoMode() ? demoVehicleBySlug(slug) : null)) as { make: string; model: string; year: number; city: string; daily_rate_lkr: number } | null;
  if (!v) return { title: "Vehicle not found" };

  return {
    title: `Rent ${v.year} ${v.make} ${v.model} in ${v.city}`,
    description: `Rent a ${v.year} ${v.make} ${v.model} in ${v.city} from ${formatLKR(v.daily_rate_lkr)}/day. DriveLink booking request fee is Rs. 0.`,
  };
}

/**
 * A listing that is not public yet still has to be viewable by the two people
 * who need to look at it: an admin deciding whether to approve it, and the
 * owner checking how it will read. Row-level security hides a pending listing
 * from the anonymous client, so both were sent to a 404 even though this page
 * already carries the "not live yet" banner written for exactly this case.
 *
 * The public read below stays first and unchanged, so nothing widens for
 * visitors. Only when that finds nothing do we ask who is asking, and the row
 * is returned solely to an admin or to someone who acts for the page that owns
 * it. Anyone else still gets the 404.
 */
async function fetchPreviewIfEntitled(slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = await createServiceClient();
  const { data } = await service
    .from("vehicles")
    .select(PUBLIC_VEHICLE_WITH_AGENCY_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role === "admin") return data;

  const agencyId = (data as { agency_id?: string }).agency_id;
  const pages = await getActingPages(supabase, user.id);
  return pages.some((page) => page.id === agencyId) ? data : null;
}

export default async function VehicleDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from, to, from_time, to_time } = (await searchParams) ?? {};
  const supabase = createPublicClient();

  const { data: publicRow, error } = await supabase
    .from("vehicles")
    .select(PUBLIC_VEHICLE_WITH_AGENCY_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error("Public vehicle detail lookup failed.", { cause: error });
  }

  const data = publicRow
    ?? (await fetchPreviewIfEntitled(slug))
    // Local design preview only; see src/lib/demo/fixtures.ts.
    ?? (isDemoMode() ? demoVehicleBySlug(slug) : null);
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

  // ── Key specs row, icon + label tiles. Presentation only: same six values
  // the page has always shown, just grouped for the header instead of a
  // separate grid further down. ──
  const specs: { label: string; value: string; Icon: LucideIcon; help?: string }[] = [
    { label: "Transmission", value: vehicle.transmission, Icon: Settings2 },
    { label: "Seats",        value: `${vehicle.seats} seats`, Icon: Users },
    ...(vehicle.fuel_type   ? [{ label: "Fuel type", value: vehicle.fuel_type, Icon: Fuel }] : []),
    ...(vehicle.luggage != null ? [{ label: "Luggage", value: `${vehicle.luggage} bag${vehicle.luggage === 1 ? "" : "s"}`, Icon: Luggage }] : []),
    { label: "Fuel policy",  value: fuelPolicyLabel(vehicle.fuel_policy), Icon: Droplets, help: FUEL_POLICY_HELP },
    { label: "Insurance",    value: insuranceLabel(vehicle.insurance_type), Icon: ShieldCheck, help: INSURANCE_HELP },
  ];

  return (
    <div className={pageShellClass("wide")}>
      <VehicleViewTracker vehicleId={vehicle.id} label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
      {!isLive && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 ring-1 ring-amber-200">
          <AlertTriangle size={16} className="mt-1 shrink-0" />
          <span>
            <strong>Preview only.</strong>{" "}
            {vehicle.status === "pending_review"
              ? "This listing is waiting for DriveLink review. It is not in search and cannot take bookings yet."
              : "This listing is not published, so it is not in search and cannot take bookings. Only people who can manage it can open this page."}
          </span>
        </div>
      )}

      {/* Gallery spans the full width above both columns on desktop. */}
      <VehicleGallery photos={photos} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />

      <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-12">

        {/* Left: content */}
        <div className="space-y-8 lg:col-span-7">

          {/* Title block */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
              {vehicleTypeLabel(vehicle.vehicle_type)} · {vehicle.city}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
              {agency.rating_avg ? (
                <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {Number(agency.rating_avg).toFixed(1)}
                  <span className="font-normal text-slate-500">({agency.rating_count ?? 0} review{(agency.rating_count ?? 0) === 1 ? "" : "s"})</span>
                </span>
              ) : (
                <span className="font-medium text-slate-500">Newly listed</span>
              )}
              <span className="text-slate-300" aria-hidden="true">·</span>
              {(agency as { slug?: string | null }).slug ? (
                <Link href={`/pages/${(agency as { slug?: string | null }).slug}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                  {agency.name}
                </Link>
              ) : (
                <span className="font-medium text-slate-900">{agency.name}</span>
              )}
              {responseTimeLabel(agency.avg_response_minutes) && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="font-medium text-emerald-700">Typically replies in {responseTimeLabel(agency.avg_response_minutes)}</span>
                </>
              )}
            </div>

            {/* Key specs row: icon + label tiles, hairline dividers instead
                of heavy boxed tiles. */}
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-3">
              {specs.map(({ label, value, Icon, help }) => (
                <div key={label} className="bg-white p-3">
                  <p className="flex items-center text-xs text-slate-500">
                    <Icon className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                    {label}
                    {help && <HelpHint text={help} />}
                  </p>
                  {/* Sentence case, not title case: only the first letter is raised, so
                      "automatic" reads "Automatic" but "Hire insurance declared"
                      does not become "Hire Insurance Declared". */}
                  <p className="mt-0.5 text-sm font-medium text-slate-900 first-letter:uppercase">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* "Before you request": one calm panel with everything that
              decides whether this listing fits, so nothing here is a
              surprise once the request is sent. */}
          <Card variant="tinted" padding="lg" className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Before you request</p>

            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-slate-700">Daily rate</p>
              <p className="text-right">
                <span className="text-2xl font-bold tabular text-slate-950">{formatLKR(vehicle.daily_rate_lkr)}</span>
                <span className="text-sm text-slate-500"> / day{siteConfig.showUsd ? ` (~$${usd})` : ""}</span>
              </p>
            </div>
            {vehicle.weekly_rate_lkr && (
              <p className="text-right text-sm font-medium text-emerald-700">or {formatLKR(vehicle.weekly_rate_lkr)} / week</p>
            )}
            {vehicle.monthly_rate_lkr && (
              <p className="text-right text-sm font-medium text-emerald-700">or {formatLKR(vehicle.monthly_rate_lkr)} / month</p>
            )}

            {/* The deposit is routinely two to three times the daily rate, and
                it is the number people actually weigh before deciding. Shown at
                the same weight as the price, with who holds it, because meeting
                it late reads as concealment even when nothing was concealed. */}
            {vehicle.deposit_lkr > 0 && (
              <div className="border-t border-blue-100 pt-4">
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
              <div className="flex flex-wrap gap-2 border-t border-blue-100 pt-4">
                {rentalOptions.map(({ label, Icon }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                ))}
              </div>
            )}

            {/* Driving requirements (F1/F3), the make-or-break info for tourists */}
            {(vehicle.self_drive || vehicle.with_driver) && (
              <div className="space-y-1.5 border-t border-blue-100 pt-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Info size={15} className="text-blue-600" /> Driving in Sri Lanka
                </p>
                {vehicle.self_drive && (
                  <p className="text-xs leading-relaxed text-slate-600">
                    <strong className="text-slate-800">Self-drive:</strong> add your licence and permit details before requesting.
                    The Rental Page checks the original documents at pickup. Driving and insurance requirements can depend on
                    your licence, permit and the provider&apos;s policy, so confirm them before travelling.
                  </p>
                )}
                {vehicle.with_driver && (
                  <p className="text-xs leading-relaxed text-slate-600">
                    <strong className="text-slate-800">With a driver:</strong> you do not drive the vehicle. Confirm the named
                    driver, licence, working hours, route limits and extra charges before handover.
                  </p>
                )}
              </div>
            )}

            {/* Licence / age requirement, self-drive only. */}
            {requirementText && (
              <p className="flex items-center gap-1.5 border-t border-blue-100 pt-4 text-xs font-medium text-slate-700">
                <IdCard size={14} className="text-blue-600" /> {requirementText}
              </p>
            )}
          </Card>

          {/* Content sections: headings and whitespace, not cards inside
              cards. Every section but the first gets a hairline above it. */}
          <div className="[&>*+*]:mt-8 [&>*+*]:border-t [&>*+*]:border-slate-200 [&>*+*]:pt-8">

            {vehicle.description && (
              <Section title="About this vehicle">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{vehicle.description}</p>
              </Section>
            )}

            {/* Rental terms: trust panel (Terms Engine) */}
            <Section title="Rental terms" description="No surprise charges: these are the terms your request is sent on.">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {includedRows.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">What&apos;s included</p>
                    <TermRows rows={includedRows} />
                  </div>
                )}
                {feeRows.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Fees you should know</p>
                    <TermRows rows={feeRows} />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">House rules</p>
                <div className="flex flex-wrap gap-1.5">
                  {ruleChips.map(({ Icon, text }) => (
                    <span key={text} className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      <Icon className="h-3 w-3 text-blue-500" /> {text}
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
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Disclosures</p>
                  <TermRows rows={disclosureRows} />
                </div>
              )}

              {withDriverRows.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">With driver</p>
                  <TermRows rows={withDriverRows} />
                </div>
              )}
            </Section>

            {vehicle.features && vehicle.features.length > 0 && (
              <Section title="Features">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {vehicle.features.map((f: string) => {
                    const FeatIcon = presetIcon(f);
                    return (
                      <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                        <FeatIcon className="h-4 w-4 shrink-0 text-blue-500" /> {f}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Handover requirements: the twelve standard rules translate, a
                host's own wording is shown as theirs. */}
            {rules.length > 0 && <HouseRules rules={rules} />}

            <Section title="Trust">
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
                      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-slate-500 hover:text-blue-600">
                        <Info size={12} /> What these badges mean
                      </summary>
                      <ul className="mt-2 space-y-1.5 pl-0.5">
                        {badges.filter((b) => BADGE_DESCRIPTIONS[b]).map((b) => (
                          <li key={b} className="leading-relaxed text-slate-600">
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
            </Section>

            {/* Insurance warning */}
            {vehicle.insurance_type === "private" && (
              <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-sm text-amber-800">
                  This vehicle has Private (P-Number) insurance. Verify coverage with the {provNoun} before renting.
                </p>
              </div>
            )}

            {/* TRUST-023: insurance expiry awareness */}
            {vehicle.insurance_expiry && new Date(vehicle.insurance_expiry as string) < new Date() && (
              <div className="flex gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-700" />
                <p className="text-sm text-rose-800">
                  The insurance on file for this vehicle shows as expired ({new Date(vehicle.insurance_expiry as string).toLocaleDateString("en-LK")}).
                  Confirm current, valid coverage with the {provNoun} before you drive.
                </p>
              </div>
            )}

            <Section title={provNounCap === "Host" ? "Vehicle host" : "Rental Page"}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                    {initials(agency.name)}
                  </span>
                  <div>
                    {(agency as { slug?: string | null }).slug ? (
                      <Link href={`/pages/${(agency as { slug?: string | null }).slug}`} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline">{agency.name}</Link>
                    ) : (
                      <p className="font-semibold text-slate-900">{agency.name}</p>
                    )}
                    <p className="mt-0.5 text-sm text-slate-600">{agency.city}</p>
                    {responseTimeLabel(agency.avg_response_minutes) && (
                      <p className="mt-0.5 text-xs font-medium text-emerald-700">Typically replies in {responseTimeLabel(agency.avg_response_minutes)}</p>
                    )}
                  </div>
                </div>
                {agency.is_verified && <Badge variant="green">Verified</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-900/[0.05]">
                <div>
                  <p className={`text-lg font-semibold ${reliabilityColor(agency.reliability_pct, rentalsDone)}`}>{reliabilityLabel(agency.reliability_pct, rentalsDone)}</p>
                  <p className="inline-flex items-center justify-center text-xs text-slate-500">Reliability <HelpHint text={RELIABILITY_HELP} /></p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{agency.rating_avg ? Number(agency.rating_avg).toFixed(1) : "-"}</p>
                  <p className="inline-flex items-center justify-center text-xs text-slate-500">Rating <HelpHint text={RATING_HELP} /></p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{agency.rating_count ?? 0}</p>
                  <p className="inline-flex items-center justify-center text-xs text-slate-500">Reviews <HelpHint text={REVIEW_COUNT_HELP} /></p>
                </div>
              </div>
            </Section>

            <Section title="Guest reviews">
              {reviews.length === 0 ? (
                <p className="text-xs italic text-slate-400">No reviews yet, be the first to rent and review this {provNoun}.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="space-y-1.5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-900/[0.05]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{rev.reviewer?.full_name ?? "Verified renter"}</span>
                        <span className="text-xs text-slate-400">{new Date(rev.created_at).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" })}</span>
                      </div>
                      <div className="flex text-amber-400">
                        {Array.from({ length: rev.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                      </div>
                      {rev.comment && <p className="text-sm italic leading-normal text-slate-600">&ldquo;{rev.comment}&rdquo;</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="How it works">
              <ol className="space-y-3">
                {[
                  "You send a booking request, free, no payment",
                  "DriveLink verifies your details (licence for self-drive)",
                  `The ${provNoun} confirms availability`,
                  `${provNounCap} contact unlocks so you can sync the handover`,
                  `Pickup & return, pay the ${provNoun} directly`,
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-600">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        </div>

        {/* Right: sticky booking panel */}
        <div className="lg:col-span-5">
          <div id="request" className="scroll-mt-24 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-900/[0.06] sm:p-6 lg:sticky lg:top-24">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular text-slate-950">{formatLKR(vehicle.daily_rate_lkr)}</span>
              <span className="text-sm text-slate-500">/ day{siteConfig.showUsd ? ` (~$${usd})` : ""}</span>
            </div>
            {vehicle.deposit_lkr > 0 && (
              <p className="mt-1 text-xs text-slate-500">{formatLKR(vehicle.deposit_lkr)} refundable deposit</p>
            )}

            <div className="mt-5 border-t border-slate-100 pt-5">
              {!isLive ? (
                <>
                  <h2 className="text-base font-semibold text-slate-900">Not accepting bookings</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {vehicle.status === "pending_review"
                      ? "Once DriveLink approves this listing, the request form appears here and renters can send dates."
                      : "This listing is not published. Publish it from your fleet to start receiving booking requests."}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-slate-900">Request this vehicle</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    The {provNoun} will review your dates.
                  </p>
                  <div className="mt-4">
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
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    DriveLink&apos;s booking confirmation fee is Rs. 0. Once they confirm availability, their contact unlocks.
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 text-right">
              <ReportListingButton vehicleId={vehicle.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Thumb-reachable action for the whole listing. This page is long on a
          phone, and without it the only way to act is to remember where the
          request card was and scroll back to it. Hidden on desktop, where that
          card is already on screen, and hidden entirely when the listing is not
          taking bookings, since it would link to a card that refuses them. */}
      {isLive && (
      <ActionBar
        summary={
          <span className="block">
            <span className="block">
              <strong className="tabular text-base text-slate-950">{formatLKR(vehicle.daily_rate_lkr)}</strong> / day
            </span>
            {vehicle.deposit_lkr ? (
              <span className="block text-xs text-slate-500">{formatLKR(vehicle.deposit_lkr)} refundable deposit</span>
            ) : null}
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
      )}
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

// Two-letter initial avatar for a provider without a logo image.
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "DL";
}
