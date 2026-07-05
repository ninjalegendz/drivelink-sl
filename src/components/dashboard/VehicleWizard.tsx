"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, X, Check, Car, Truck, Bus, Bike, ChevronLeft, ChevronRight, Upload, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Select } from "@/components/ui/Select";
import { PresetPicker } from "@/components/dashboard/PresetPicker";
import { SL_CITIES } from "@/data/cities";
import { RULE_PRESETS, FEATURE_PRESETS, SL_MAKES } from "@/data/vehicle-presets";
import { buildVehicleSlug } from "@/lib/vehicles/slug";
import type { VehicleType } from "@/types/database";

const TYPE_TILES: { value: VehicleType; label: string; Icon: typeof Car }[] = [
  { value: "car",    label: "Car",     Icon: Car },
  { value: "suv",    label: "SUV",     Icon: Car },
  { value: "van",    label: "Van",     Icon: Bus },
  { value: "bike",   label: "Bike",    Icon: Bike },
  { value: "tuktuk", label: "Tuk-Tuk", Icon: Truck },
];
const FUEL_TILES = ["petrol", "diesel", "hybrid", "electric"];
const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));
const CURRENT_YEAR = new Date().getFullYear();
const DRAFT_KEY = "drivelink_vehicle_wizard_draft";

const BODY_TYPE_OPTIONS = [
  "Sedan", "Hatchback", "SUV", "Crossover", "Wagon", "Coupe", "Pickup", "Mini", "Van", "Other",
].map((v) => ({ value: v, label: v }));

// restricted_use fixed vocabulary (DB text[] column) → human labels shown as "Not allowed" chips.
const RESTRICTED_USE_OPTIONS: { value: string; label: string }[] = [
  { value: "unpaved_roads",         label: "Unpaved roads" },
  { value: "beach_sand",            label: "Beach / sand driving" },
  { value: "hill_country",          label: "Steep hill-country routes" },
  { value: "flood_water",           label: "Driving through flood water" },
  { value: "long_haul_north_east",  label: "Long-haul North/East trips" },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

// Subset of a vehicles row used to seed the wizard when duplicating an
// existing listing. Photos/docs are per-vehicle so they are NOT copied.
export interface WizardPrefill {
  make: string; model: string; year: number;
  vehicle_type: VehicleType | null;
  daily_rate_lkr: number; deposit_lkr: number | null;
  self_drive: boolean | null; with_driver: boolean | null; airport_pickup: boolean | null;
  transmission: string; seats: number; fuel_type: string | null; city: string;
  insurance_type: "hire" | "private"; mileage_limit: string | null;
  rules: string[] | null; features: string[] | null; description: string | null;
}

interface Props { agencyId: string; agencyCity: string; prefill?: WizardPrefill | null; }

const STEPS = ["Photos", "Vehicle", "Price", "How to rent", "Rules & docs", "Rental terms", "Review"];

export function VehicleWizard({ agencyId, agencyCity, prefill }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Text draft (autosaved). Files can't be persisted, so photos/docs reset on reload.
  // When duplicating (prefill), state seeds from the source vehicle instead.
  const [make, setMake] = useState(prefill?.make ?? "");
  const [model, setModel] = useState(prefill?.model ?? "");
  const [year, setYear] = useState<number | "">(prefill?.year ?? CURRENT_YEAR - 3);
  const [vehicleType, setVehicleType] = useState<VehicleType>(prefill?.vehicle_type ?? "car");
  const [dailyRate, setDailyRate] = useState(prefill ? String(prefill.daily_rate_lkr) : "");
  const [deposit, setDeposit] = useState(prefill?.deposit_lkr ? String(prefill.deposit_lkr) : "");
  const [selfDrive, setSelfDrive] = useState(prefill?.self_drive ?? true);
  const [withDriver, setWithDriver] = useState(prefill?.with_driver ?? false);
  const [airportPickup, setAirportPickup] = useState(prefill?.airport_pickup ?? false);
  const [transmission, setTransmission] = useState(prefill?.transmission ?? "automatic");
  const [seats, setSeats] = useState(prefill?.seats ?? 5);
  const [fuelType, setFuelType] = useState(prefill?.fuel_type ?? "");
  const [city, setCity] = useState(prefill?.city ?? agencyCity);
  const [insuranceType, setInsuranceType] = useState<"hire" | "private">(prefill?.insurance_type ?? "hire");
  const [rules, setRules] = useState<string[]>(prefill?.rules ?? []);
  const [features, setFeatures] = useState<string[]>(prefill?.features ?? []);
  const [description, setDescription] = useState(prefill?.description ?? "");

  // ── Vehicle identity (optional, Step: Vehicle) ──
  const [bodyType, setBodyType] = useState("");
  const [variant, setVariant] = useState("");
  const [doors, setDoors] = useState("");
  const [engineCc, setEngineCc] = useState("");
  const [odometerKm, setOdometerKm] = useState("");

  // ── Rental terms (Step: Rental terms) — SL defaults pre-filled ──
  const [weeklyRate, setWeeklyRate] = useState("");
  const [includedKmPerDay, setIncludedKmPerDay] = useState("100");
  const [unlimitedKm, setUnlimitedKm] = useState(false);
  const [extraMileage, setExtraMileage] = useState("");
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [minRentalDays, setMinRentalDays] = useState("1");
  const [maxRentalDays, setMaxRentalDays] = useState("");

  const [cleaningFee, setCleaningFee] = useState("5000");
  const [refuelFee, setRefuelFee] = useState("1000");
  const [lateFeePerHour, setLateFeePerHour] = useState("");

  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [rideHailAllowed, setRideHailAllowed] = useState(false);
  const [secondDriverAllowed, setSecondDriverAllowed] = useState(true);
  const [restrictedUse, setRestrictedUse] = useState<string[]>([]);

  const [minRenterAge, setMinRenterAge] = useState("23");
  const [minLicenseYears, setMinLicenseYears] = useState("2");

  const [hasGpsTracker, setHasGpsTracker] = useState(false);
  const [hasEtcTag, setHasEtcTag] = useState(false);

  const [perKmRate, setPerKmRate] = useState("");
  const [tollsIncluded, setTollsIncluded] = useState<boolean | null>(null);
  const [driverBata, setDriverBata] = useState("");

  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [crFile, setCrFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Autosave text fields ──
  useEffect(() => {
    if (prefill) return; // duplicating: keep the seeded values, don't load a stale draft
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setMake(d.make ?? ""); setModel(d.model ?? ""); setYear(d.year ?? CURRENT_YEAR - 3);
        setVehicleType(d.vehicleType ?? "car"); setDailyRate(d.dailyRate ?? ""); setDeposit(d.deposit ?? "");
        setSelfDrive(d.selfDrive ?? true); setWithDriver(d.withDriver ?? false); setAirportPickup(d.airportPickup ?? false);
        setTransmission(d.transmission ?? "automatic"); setSeats(d.seats ?? 5); setFuelType(d.fuelType ?? "");
        setCity(d.city ?? agencyCity); setInsuranceType(d.insuranceType ?? "hire");
        // Older drafts stored rules as newline text; migrate them to the chip list.
        setRules(Array.isArray(d.rules) ? d.rules : (d.rulesText ? String(d.rulesText).split("\n").map((s: string) => s.trim()).filter(Boolean) : []));
        setFeatures(Array.isArray(d.features) ? d.features : []);
        setDescription(d.description ?? "");
        setBodyType(d.bodyType ?? ""); setVariant(d.variant ?? ""); setDoors(d.doors ?? "");
        setEngineCc(d.engineCc ?? ""); setOdometerKm(d.odometerKm ?? "");
        setWeeklyRate(d.weeklyRate ?? ""); setIncludedKmPerDay(d.includedKmPerDay ?? "100"); setUnlimitedKm(d.unlimitedKm ?? false);
        setExtraMileage(d.extraMileage ?? ""); setDeliveryAvailable(d.deliveryAvailable ?? false); setDeliveryFee(d.deliveryFee ?? "");
        setMinRentalDays(d.minRentalDays ?? "1"); setMaxRentalDays(d.maxRentalDays ?? "");
        setCleaningFee(d.cleaningFee ?? "5000"); setRefuelFee(d.refuelFee ?? "1000"); setLateFeePerHour(d.lateFeePerHour ?? "");
        setSmokingAllowed(d.smokingAllowed ?? false); setPetsAllowed(d.petsAllowed ?? false);
        setRideHailAllowed(d.rideHailAllowed ?? false); setSecondDriverAllowed(d.secondDriverAllowed ?? true);
        setRestrictedUse(Array.isArray(d.restrictedUse) ? d.restrictedUse : []);
        setMinRenterAge(d.minRenterAge ?? "23"); setMinLicenseYears(d.minLicenseYears ?? "2");
        setHasGpsTracker(d.hasGpsTracker ?? false); setHasEtcTag(d.hasEtcTag ?? false);
        setPerKmRate(d.perKmRate ?? ""); setTollsIncluded(d.tollsIncluded ?? null); setDriverBata(d.driverBata ?? "");
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const d = {
      make, model, year, vehicleType, dailyRate, deposit, selfDrive, withDriver, airportPickup, transmission, seats, fuelType, city, insuranceType, rules, features, description,
      bodyType, variant, doors, engineCc, odometerKm,
      weeklyRate, includedKmPerDay, unlimitedKm, extraMileage, deliveryAvailable, deliveryFee, minRentalDays, maxRentalDays,
      cleaningFee, refuelFee, lateFeePerHour,
      smokingAllowed, petsAllowed, rideHailAllowed, secondDriverAllowed, restrictedUse,
      minRenterAge, minLicenseYears, hasGpsTracker, hasEtcTag,
      perKmRate, tollsIncluded, driverBata,
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }, [make, model, year, vehicleType, dailyRate, deposit, selfDrive, withDriver, airportPickup, transmission, seats, fuelType, city, insuranceType, rules, features, description,
      bodyType, variant, doors, engineCc, odometerKm,
      weeklyRate, includedKmPerDay, unlimitedKm, extraMileage, deliveryAvailable, deliveryFee, minRentalDays, maxRentalDays,
      cleaningFee, refuelFee, lateFeePerHour,
      smokingAllowed, petsAllowed, rideHailAllowed, secondDriverAllowed, restrictedUse,
      minRenterAge, minLicenseYears, hasGpsTracker, hasEtcTag,
      perKmRate, tollsIncluded, driverBata]);

  function stepError(s: number): string | null {
    if (s === 1) {
      if (!make.trim() || !model.trim()) return "Add the make and model.";
      if (!year || String(year).length !== 4) return "Add a 4-digit year.";
    }
    if (s === 2 && (!dailyRate || Number(dailyRate) < 500)) return "Add a daily price (min Rs. 500).";
    if (s === 3 && !selfDrive && !withDriver && !airportPickup) return "Pick at least one way to rent it.";
    return null;
  }

  function next() {
    const e = stepError(step);
    if (e) { setError(e); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() { setError(null); setStep((s) => Math.max(0, s - 1)); }

  async function submit() {
    setLoading(true); setError(null);
    try {
      const photoUrls: string[] = [];
      for (const { file } of photos) {
        try { photoUrls.push((await uploadToR2("vehicle-photos", file)).publicUrl); } catch { /* skip failed */ }
      }
      let crUrl: string | null = null, insUrl: string | null = null;
      if (crFile)        crUrl  = (await uploadToR2("vehicle-docs", crFile)).publicUrl;
      if (insuranceFile) insUrl = (await uploadToR2("vehicle-docs", insuranceFile)).publicUrl;

      const cleanRules    = Array.from(new Set(rules.map((s) => s.trim()).filter(Boolean)));
      const cleanFeatures = Array.from(new Set(features.map((s) => s.trim()).filter(Boolean)));
      const supabase = createClient();
      const slug = `${buildVehicleSlug(make, model, city, Number(year))}-${crypto.randomUUID().slice(0, 6)}`;

      // Derived for backward compatibility: existing listing pages still read the legacy
      // free-text mileage_limit column, so we keep it in sync with the structured fields.
      const mileageLimitDerived = unlimitedKm
        ? "Unlimited"
        : (includedKmPerDay ? `${Number(includedKmPerDay)} km/day` : null);

      const { data: inserted, error: insErr } = await supabase
        .from("vehicles")
        .insert({
          agency_id: agencyId, slug, status: "pending_review",
          make: make.trim(), model: model.trim(), year: Number(year),
          vehicle_type: vehicleType, daily_rate_lkr: Number(dailyRate), deposit_lkr: Number(deposit) || 0,
          self_drive: selfDrive, with_driver: withDriver, airport_pickup: airportPickup,
          transmission, seats, fuel_type: fuelType || null, city,
          insurance_type: insuranceType, mileage_limit: mileageLimitDerived,
          rules: cleanRules, features: cleanFeatures.length ? cleanFeatures : null,
          description: description.trim() || null,
          photos: photoUrls.length ? photoUrls : null,
          // ── Vehicle identity (optional) ──
          body_type: bodyType || null,
          variant: variant.trim() || null,
          doors: doors ? Number(doors) : null,
          engine_cc: engineCc ? Number(engineCc) : null,
          odometer_km: odometerKm ? Number(odometerKm) : null,
          // ── Rental terms ──
          weekly_rate_lkr: weeklyRate ? Number(weeklyRate) : null,
          included_km_per_day: unlimitedKm ? null : (includedKmPerDay ? Number(includedKmPerDay) : null),
          unlimited_km: unlimitedKm,
          extra_mileage_lkr: extraMileage ? Number(extraMileage) : null,
          delivery_available: deliveryAvailable,
          delivery_fee_lkr: deliveryAvailable && deliveryFee ? Number(deliveryFee) : null,
          min_rental_days: Math.max(minRentalDays ? Number(minRentalDays) : 1, 1),
          max_rental_days: maxRentalDays ? Number(maxRentalDays) : null,
          // ── Deposit & fees ──
          cleaning_fee_lkr: clamp(cleaningFee ? Number(cleaningFee) : 5000, 0, 10000),
          refuel_fee_lkr: refuelFee ? Number(refuelFee) : 1000,
          late_fee_per_hour_lkr: lateFeePerHour ? Number(lateFeePerHour) : null,
          // ── House rules ──
          smoking_allowed: smokingAllowed,
          pets_allowed: petsAllowed,
          ride_hail_allowed: rideHailAllowed,
          second_driver_allowed: secondDriverAllowed,
          restricted_use: restrictedUse,
          // ── Renter requirements ──
          min_renter_age: clamp(minRenterAge ? Number(minRenterAge) : 23, 18, 40),
          min_license_years: minLicenseYears ? Number(minLicenseYears) : 2,
          // ── Disclosures ──
          has_gps_tracker: hasGpsTracker,
          has_etc_tag: hasEtcTag,
          // ── With-driver terms ──
          per_km_rate_lkr: withDriver && perKmRate ? Number(perKmRate) : null,
          tolls_included: withDriver ? tollsIncluded : null,
          driver_bata_lkr: withDriver && driverBata ? Number(driverBata) : null,
        })
        .select("id").single();

      if (insErr) throw new Error(insErr.message);
      const vehicleId = (inserted as { id: string }).id;

      if (crUrl || insUrl) {
        await supabase.from("vehicle_documents").upsert({ vehicle_id: vehicleId, cr_url: crUrl, insurance_url: insUrl }, { onConflict: "vehicle_id" });
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      router.push("/dashboard/vehicles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Step {step + 1} of {STEPS.length}</p>
      <h2 className="font-display text-2xl font-extrabold text-slate-900 mb-5">{STEPS[step]}</h2>

      {/* ── Step 0: Photos ── */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-slate-600 text-sm">Add a few clear photos. The first one is the cover.</p>
          <input id="wizard-photo-input" type="file" accept="image/*" multiple className="sr-only"
            onChange={(e) => { if (e.target.files) { const items = Array.from(e.target.files).map((file) => ({ file, url: URL.createObjectURL(file) })); setPhotos((p) => [...p, ...items]); } e.target.value = ""; }} />
          <label htmlFor="wizard-photo-input"
            className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-colors">
            <Camera size={36} className="mx-auto mb-2 text-blue-600" strokeWidth={1.5} />
            <p className="text-slate-700 font-semibold">Tap to add photos</p>
            <p className="text-slate-400 text-xs mt-0.5">JPG or PNG, add 3 or more</p>
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((item, i) => (
                <div key={item.url} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-blue-600 text-white font-semibold px-1.5 py-0.5 rounded">Cover</span>}
                  <button type="button" onClick={() => { URL.revokeObjectURL(item.url); setPhotos((p) => p.filter((_, j) => j !== i)); }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 hover:bg-rose-500 text-white flex items-center justify-center"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Vehicle ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-slate-600 text-sm mb-2">What kind of vehicle is it?</p>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_TILES.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => setVehicleType(value)}
                  className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 font-semibold text-sm transition-all ${vehicleType === value ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  <Icon size={22} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BigField label="Make">
              <input className={bigInput} value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" list="sl-makes" />
              <datalist id="sl-makes">
                {SL_MAKES.map((m) => <option key={m} value={m} />)}
              </datalist>
            </BigField>
            <BigField label="Model"><input className={bigInput} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Aqua" /></BigField>
          </div>
          <BigField label="Year"><input className={bigInput} type="number" value={year} onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))} placeholder="2018" /></BigField>
          <div className="grid grid-cols-2 gap-3">
            <BigField label="Body type (optional)"><Select value={bodyType} onChange={setBodyType} options={BODY_TYPE_OPTIONS} placeholder="Select…" /></BigField>
            <BigField label="Variant (optional)"><input className={bigInput} value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="GLi, Hybrid, etc." /></BigField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <BigField label="Doors (optional)"><input className={bigInput} type="number" value={doors} onChange={(e) => setDoors(e.target.value)} min={1} max={6} placeholder="4" /></BigField>
            <BigField label="Engine cc (optional)"><input className={bigInput} type="number" value={engineCc} onChange={(e) => setEngineCc(e.target.value)} min={0} placeholder="1500" /></BigField>
            <BigField label="Odometer km (optional)"><input className={bigInput} type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} min={0} placeholder="65000" /></BigField>
          </div>
        </div>
      )}

      {/* ── Step 2: Price ── */}
      {step === 2 && (
        <div className="space-y-5">
          <BigField label="Price per day (LKR)">
            <input className={`${bigInput} text-2xl font-bold`} type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="6500" min={500} step={100} />
          </BigField>
          <p className="text-slate-400 text-xs">Deposit and other fees come next, in the rental terms step.</p>
        </div>
      )}

      {/* ── Step 3: How to rent ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <p className="text-slate-600 text-sm mb-2">How can people rent it? (tap all that apply)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Self-drive", on: selfDrive, set: setSelfDrive },
                { label: "With driver", on: withDriver, set: setWithDriver },
                { label: "Airport pickup", on: airportPickup, set: setAirportPickup },
              ].map(({ label, on, set }) => (
                <button key={label} type="button" onClick={() => set(!on)}
                  className={`py-4 rounded-2xl border-2 font-semibold text-sm transition-all ${on ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {on && <Check size={14} className="inline mr-1" />}{label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-600 text-sm mb-2">Transmission</p>
              <div className="grid grid-cols-2 gap-2">
                {["automatic", "manual"].map((t) => (
                  <button key={t} type="button" onClick={() => setTransmission(t)}
                    className={`py-3 rounded-xl border-2 font-semibold text-xs capitalize ${transmission === t ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{t}</button>
                ))}
              </div>
            </div>
            <BigField label="Seats"><input className={bigInput} type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value))} min={1} max={20} /></BigField>
          </div>
          <div>
            <p className="text-slate-600 text-sm mb-2">Fuel (optional)</p>
            <div className="grid grid-cols-4 gap-2">
              {FUEL_TILES.map((f) => (
                <button key={f} type="button" onClick={() => setFuelType(fuelType === f ? "" : f)}
                  className={`py-2.5 rounded-xl border-2 font-semibold text-xs capitalize ${fuelType === f ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{f}</button>
              ))}
            </div>
          </div>
          <BigField label="City"><Select value={city} onChange={setCity} options={CITY_OPTIONS} /></BigField>
        </div>
      )}

      {/* ── Step 4: Rules & docs ── */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <p className="text-slate-600 text-sm mb-2">Insurance</p>
            <div className="grid grid-cols-2 gap-2">
              {([["hire", "Hire (commercial)"], ["private", "Private (P-number)"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setInsuranceType(v)}
                  className={`py-3 rounded-xl border-2 font-semibold text-xs ${insuranceType === v ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-slate-600 text-sm mb-0.5">Features (optional)</p>
            <p className="text-slate-400 text-xs mb-2">Tap everything this vehicle has.</p>
            <PresetPicker presets={FEATURE_PRESETS} value={features} onChange={setFeatures} addPlaceholder="Add another feature" />
          </div>
          <div>
            <p className="text-slate-600 text-sm mb-0.5">Handover rules (optional)</p>
            <p className="text-slate-400 text-xs mb-2">Tap the rules that apply, renters see these on the listing.</p>
            <PresetPicker presets={RULE_PRESETS} value={rules} onChange={setRules} addPlaceholder="Add your own rule" />
          </div>
          <div>
            <p className="text-slate-600 text-sm mb-0.5">Documents (optional)</p>
            <p className="text-slate-400 text-xs mb-2">
              Optional now — upload these to earn the Verified Vehicle badge (better ranking, more bookings). We&apos;ll also ask before your first confirmed booking.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DocPick label="Registration (CR)" file={crFile} onPick={setCrFile} />
              <DocPick label="Insurance" file={insuranceFile} onPick={setInsuranceFile} />
            </div>
            <p className="text-slate-400 text-xs mt-1.5">Documents are private, only DriveLink admins see them.</p>
          </div>
        </div>
      )}

      {/* ── Step 5: Rental terms ── */}
      {step === 5 && (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm -mt-2">
            These become part of every booking&apos;s rental agreement. Standard Sri Lankan defaults are pre-filled — change only what&apos;s different for this vehicle.
          </p>

          {/* Pricing extras */}
          <div className="space-y-3">
            <SectionHeading>Pricing extras</SectionHeading>
            <BigField label="Weekly rate (optional)"><input className={bigInput} type="number" value={weeklyRate} onChange={(e) => setWeeklyRate(e.target.value)} placeholder="e.g. 40000" min={0} step={500} /></BigField>
            <div className="grid grid-cols-2 gap-3">
              <BigField label="Included km/day" hint={unlimitedKm ? undefined : "Extra km beyond this is charged"}>
                <input className={bigInput} type="number" value={unlimitedKm ? "" : includedKmPerDay} onChange={(e) => setIncludedKmPerDay(e.target.value)}
                  disabled={unlimitedKm} placeholder={unlimitedKm ? "Unlimited" : "100"} min={0} />
              </BigField>
              <BigField label="Extra km charge (LKR/km)"><input className={bigInput} type="number" value={extraMileage} onChange={(e) => setExtraMileage(e.target.value)} placeholder="e.g. 30" min={0} /></BigField>
            </div>
            <ToggleField label="Unlimited km" on={unlimitedKm} onChange={setUnlimitedKm} />
            <ToggleField label="Delivery available" hint="Deliver the vehicle to the renter for a fee" on={deliveryAvailable} onChange={setDeliveryAvailable} />
            {deliveryAvailable && (
              <BigField label="Delivery fee (LKR)"><input className={bigInput} type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="e.g. 1500" min={0} /></BigField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <BigField label="Min rental days"><input className={bigInput} type="number" value={minRentalDays} onChange={(e) => setMinRentalDays(e.target.value)} min={1} /></BigField>
              <BigField label="Max rental days (optional)"><input className={bigInput} type="number" value={maxRentalDays} onChange={(e) => setMaxRentalDays(e.target.value)} min={1} placeholder="No limit" /></BigField>
            </div>
          </div>

          {/* Deposit & fees */}
          <div className="space-y-3">
            <SectionHeading>Deposit &amp; fees</SectionHeading>
            <BigField label="Refundable deposit (LKR)" hint="Held by you, returned after the rental. Leave blank for none.">
              <input className={bigInput} type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" min={0} step={1000} />
            </BigField>
            <div className="grid grid-cols-2 gap-3">
              <BigField label="Cleaning fee" hint="If returned excessively dirty, up to Rs. 10,000">
                <input className={bigInput} type="number" value={cleaningFee} onChange={(e) => setCleaningFee(e.target.value)} min={0} max={10000} step={500} />
              </BigField>
              <BigField label="Refuel service fee"><input className={bigInput} type="number" value={refuelFee} onChange={(e) => setRefuelFee(e.target.value)} min={0} step={100} /></BigField>
            </div>
            <BigField label="Late fee per hour (optional)"><input className={bigInput} type="number" value={lateFeePerHour} onChange={(e) => setLateFeePerHour(e.target.value)} min={0} placeholder="auto: daily rate ÷ 8" /></BigField>
          </div>

          {/* House rules */}
          <div className="space-y-2">
            <SectionHeading>House rules</SectionHeading>
            <ToggleField label="Smoking allowed" on={smokingAllowed} onChange={setSmokingAllowed} />
            <ToggleField label="Pets allowed" on={petsAllowed} onChange={setPetsAllowed} />
            <ToggleField label="Ride-hail / commercial use allowed" on={rideHailAllowed} onChange={setRideHailAllowed} />
            <ToggleField label="Second driver allowed" on={secondDriverAllowed} onChange={setSecondDriverAllowed} />
            <div className="pt-1">
              <p className="text-slate-600 text-sm mb-2">Not allowed:</p>
              <div className="flex flex-wrap gap-1.5">
                {RESTRICTED_USE_OPTIONS.map(({ value, label }) => {
                  const on = restrictedUse.includes(value);
                  return (
                    <button key={value} type="button"
                      onClick={() => setRestrictedUse((r) => on ? r.filter((v) => v !== value) : [...r, value])}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${on ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                      {on && <Check size={12} />} {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Renter requirements */}
          <div className="space-y-3">
            <SectionHeading>Renter requirements</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <BigField label="Min age"><input className={bigInput} type="number" value={minRenterAge} onChange={(e) => setMinRenterAge(e.target.value)} min={18} max={40} /></BigField>
              <BigField label="Min years holding licence"><input className={bigInput} type="number" value={minLicenseYears} onChange={(e) => setMinLicenseYears(e.target.value)} min={0} /></BigField>
            </div>
          </div>

          {/* Disclosures */}
          <div className="space-y-2">
            <SectionHeading>Disclosures</SectionHeading>
            <ToggleField label="GPS tracker fitted" hint="Disclosed to renters in the rental agreement, as required" on={hasGpsTracker} onChange={setHasGpsTracker} />
            <ToggleField label="ETC expressway tag fitted" hint="Tag charges during a rental are billed to the renter" on={hasEtcTag} onChange={setHasEtcTag} />
          </div>

          {/* With-driver terms */}
          {withDriver && (
            <div className="space-y-3">
              <SectionHeading>With-driver terms</SectionHeading>
              <div className="grid grid-cols-2 gap-3">
                <BigField label="Per-km rate (optional)"><input className={bigInput} type="number" value={perKmRate} onChange={(e) => setPerKmRate(e.target.value)} min={0} placeholder="e.g. 60" /></BigField>
                <BigField label="Driver overnight allowance (Rs/night)"><input className={bigInput} type="number" value={driverBata} onChange={(e) => setDriverBata(e.target.value)} min={0} placeholder="2000" /></BigField>
              </div>
              <div>
                <p className="text-slate-600 text-sm mb-2">Tolls included in price?</p>
                <div className="grid grid-cols-2 gap-2">
                  {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => (
                    <button key={l} type="button" onClick={() => setTollsIncluded(v)}
                      className={`py-3 rounded-xl border-2 font-semibold text-xs ${tollsIncluded === v ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 6: Review ── */}
      {step === 6 && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 text-sm">
            <Row k="Vehicle" v={`${year} ${make} ${model}`} />
            <Row k="Type" v={vehicleType} />
            <Row k="Price/day" v={`Rs. ${Number(dailyRate || 0).toLocaleString("en-LK")}`} />
            <Row k="Deposit" v={deposit ? `Rs. ${Number(deposit).toLocaleString("en-LK")}` : "None"} />
            <Row k="Rent as" v={[selfDrive && "Self-drive", withDriver && "With driver", airportPickup && "Airport"].filter(Boolean).join(", ") || "-"} />
            <Row k="City" v={city} />
            <Row k="Photos" v={`${photos.length}`} />
            <Row k="Features" v={features.length ? `${features.length} selected` : "None"} />
            <Row k="Rules" v={rules.length ? `${rules.length} selected` : "None"} />
            <Row k="Documents" v={[crFile && "CR", insuranceFile && "Insurance"].filter(Boolean).join(", ") || "None yet"} />
            <Row k="Rental terms" v={unlimitedKm ? "Unlimited km" : `${includedKmPerDay || 100} km/day included`} />
          </div>
          <p className="text-slate-500 text-xs">We&apos;ll review your listing and publish it once it&apos;s verified. You can edit it any time.</p>
        </div>
      )}

      {error && <p className="text-rose-600 text-sm mt-4">{error}</p>}

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 mt-7">
        <button type="button" onClick={back} disabled={step === 0 || loading}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={loading}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 transition-colors">
            {loading ? "Publishing…" : "Submit listing"}
          </button>
        )}
      </div>
    </div>
  );
}

const bigInput = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white";

function BigField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-slate-700 text-sm font-medium mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-slate-400 text-xs mt-1 block">{hint}</span>}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-800 capitalize text-right">{v}</span></div>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-900 text-sm font-bold uppercase tracking-wide">{children}</p>;
}

function ToggleField({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${on ? "bg-blue-50 border-blue-500" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
      <span>
        <span className={`block text-sm font-semibold ${on ? "text-blue-700" : "text-slate-700"}`}>{label}</span>
        {hint && <span className="block text-slate-400 text-xs mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 w-10 h-6 rounded-full relative transition-colors ${on ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function DocPick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  const inputId = useId();
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-slate-700 text-xs font-medium mb-2">{label}</p>
      <input id={inputId} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
      <label htmlFor={inputId}
        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${file ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-dashed border-slate-300 hover:border-blue-500"}`}>
        {file ? <><Check size={13} /> {file.name.slice(0, 16)}</> : <><Upload size={13} /> Upload</>}
      </label>
      <p className="text-slate-400 text-[10px] mt-1.5 inline-flex items-center gap-1"><FileText size={10} /> JPG/PNG/PDF</p>
    </div>
  );
}
