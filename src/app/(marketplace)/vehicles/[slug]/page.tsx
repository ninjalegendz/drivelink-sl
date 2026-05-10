import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { HelpHint } from "@/components/ui/HelpHint";
import { BookingRequestForm } from "@/components/booking/BookingRequestForm";
import { VehicleGallery } from "@/components/vehicles/VehicleGallery";
import { formatLKR, insuranceLabel, fuelPolicyLabel, reliabilityColor, reliabilityLabel, RELIABILITY_HELP, RATING_HELP, REVIEW_COUNT_HELP } from "@/lib/vehicles/format";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";

const INSURANCE_HELP =
  "Hire Insurance: vehicle is licensed for commercial rental — fully covered if anything goes wrong. " +
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
    description: `Rent a ${v.year} ${v.make} ${v.model} in ${v.city} from ${formatLKR(v.daily_rate_lkr)}/day. Verified agency, locked-in pricing via DriveLink SL.`,
  };
}

export default async function VehicleDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("vehicles")
    .select("*, agencies(id, name, city, whatsapp_number, is_verified, reliability_pct, cancellation_count, profiles!owner_id(rating_avg, rating_count))")
    .eq("slug", slug)
    .single();

  if (!data) notFound();

  const vehicle = data as unknown as VehicleWithAgency;
  const agency = vehicle.agencies!;
  const photos = vehicle.photos ?? [];

  // Fetch already-blocked date ranges so the booking form can warn renters upfront.
  // Only confirmed/payment_pending/active count — pending requests don't block.
  const todayIso = new Date().toISOString().split("T")[0];
  const { data: bookedRows } = await supabase
    .from("bookings")
    .select("start_date, end_date")
    .eq("vehicle_id", vehicle.id)
    .in("status", ["confirmed", "payment_pending", "active"])
    .gte("end_date", todayIso)
    .order("start_date", { ascending: true });

  const bookedRanges = (bookedRows ?? []).map(
    (r) => ({ start: (r as { start_date: string }).start_date, end: (r as { end_date: string }).end_date })
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {vehicle.status === "pending_review" && (
        <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-400 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>Admin preview</strong> — this listing is pending review and is not visible to the public yet.</span>
        </div>
      )}
      <div className="grid lg:grid-cols-5 gap-8">

        {/* Left: photos + details */}
        <div className="lg:col-span-3 space-y-6">

          <VehicleGallery
            photos={photos}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          />

          {/* Title + price */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <p className="text-slate-400 mt-0.5">{vehicle.city}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-400">{formatLKR(vehicle.daily_rate_lkr)}</p>
                <p className="text-slate-500 text-sm">per day</p>
                {vehicle.monthly_rate_lkr && (
                  <p className="text-emerald-400 text-xs mt-1 font-medium">
                    or {formatLKR(vehicle.monthly_rate_lkr)} / month
                  </p>
                )}
              </div>
            </div>
            {vehicle.deposit_lkr > 0 && (
              <p className="text-slate-400 text-sm mt-1">+ {formatLKR(vehicle.deposit_lkr)} refundable deposit</p>
            )}
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Transmission", value: vehicle.transmission },
              { label: "Seats",        value: `${vehicle.seats} seats` },
              { label: "Fuel Policy",  value: fuelPolicyLabel(vehicle.fuel_policy), help: FUEL_POLICY_HELP },
              { label: "Insurance",    value: insuranceLabel(vehicle.insurance_type), help: INSURANCE_HELP },
            ].map(({ label, value, help }) => (
              <div key={label} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                <p className="text-slate-500 text-xs flex items-center">
                  {label}
                  {help && <HelpHint text={help} />}
                </p>
                <p className="text-white text-sm font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {vehicle.description && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">About this vehicle</p>
              <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{vehicle.description}</p>
            </div>
          )}

          {/* Insurance warning */}
          {vehicle.insurance_type === "private" && (
            <div className="flex gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-sm">
                This vehicle has Private (P-Number) insurance. Verify coverage with the agency before renting.
              </p>
            </div>
          )}

          {/* Features */}
          {vehicle.features && vehicle.features.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Features</p>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((f: string) => <Badge key={f} variant="slate">{f}</Badge>)}
              </div>
            </div>
          )}
        </div>

        {/* Right: agency + booking */}
        <div className="lg:col-span-2 space-y-4">

          {/* Agency card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-white">{agency.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{agency.city}</p>
              </div>
              {agency.is_verified && <Badge variant="green">Verified Agency</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={`text-lg font-bold ${reliabilityColor(agency.reliability_pct)}`}>
                  {reliabilityLabel(agency.reliability_pct)}
                </p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">
                  Reliability <HelpHint text={RELIABILITY_HELP} />
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {agency.profiles?.rating_avg ? agency.profiles.rating_avg.toFixed(1) : "—"}
                </p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">
                  Rating <HelpHint text={RATING_HELP} />
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{agency.profiles?.rating_count ?? 0}</p>
                <p className="text-slate-500 text-xs inline-flex items-center justify-center">
                  Reviews <HelpHint text={REVIEW_COUNT_HELP} />
                </p>
              </div>
            </div>
          </div>

          {/* Booking card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-white mb-1">Request this vehicle</h2>
            <p className="text-slate-400 text-xs mb-4">
              No payment yet. The agency confirms first — you pay Rs. 1,000 only after they say yes.
            </p>
            <BookingRequestForm
              vehicleId={vehicle.id}
              agencyId={vehicle.agency_id}
              dailyRateLkr={vehicle.daily_rate_lkr}
              monthlyRateLkr={vehicle.monthly_rate_lkr}
              bookedRanges={bookedRanges}
            />
          </div>

          {/* How it works */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">How it works</p>
            <ol className="space-y-2">
              {[
                "You send a request (free, no payment)",
                "Agency confirms availability via WhatsApp",
                "You pay Rs. 1,000 to lock in the booking",
                "Agency contact details unlocked instantly",
                "Meet and collect the car",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
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
