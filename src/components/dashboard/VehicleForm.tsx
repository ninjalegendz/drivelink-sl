"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, X, FileText, Check, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Button } from "@/components/ui/Button";
import { HelpHint } from "@/components/ui/HelpHint";
import { Select } from "@/components/ui/Select";
import { PresetPicker } from "@/components/dashboard/PresetPicker";
import { SL_CITIES } from "@/data/cities";
import { VEHICLE_TYPES } from "@/data/vehicles";
import { RULE_PRESETS, FEATURE_PRESETS, SL_MAKES, BODY_TYPES, RESTRICTED_USE_OPTIONS } from "@/data/vehicle-presets";
import { buildVehicleSlug } from "@/lib/vehicles/slug";
import type { Database, InsuranceType, FuelPolicy, VehicleType } from "@/types/database";

const VEHICLE_TYPE_OPTIONS = VEHICLE_TYPES.map((t) => ({ value: t.value, label: t.plural }));

const FUEL_TYPE_OPTIONS = [
  { value: "",         label: "Not specified" },
  { value: "petrol",   label: "Petrol" },
  { value: "diesel",   label: "Diesel" },
  { value: "hybrid",   label: "Hybrid" },
  { value: "electric", label: "Electric" },
] as const;

const INSURANCE_OPTIONS = [
  { value: "hire",    label: "Hire Insurance (commercial)" },
  { value: "private", label: "Private (P-Number)" },
] as const;

const FUEL_POLICY_OPTIONS = [
  { value: "full_to_full", label: "Full-to-Full" },
  { value: "same_to_same", label: "Same-to-Same" },
] as const;

const TRANSMISSION_OPTIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "manual",    label: "Manual" },
] as const;

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

const BODY_TYPE_OPTIONS = BODY_TYPES.map((v) => ({ value: v, label: v }));

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

interface Props {
  agencyId:   string;
  agencyCity: string;
  vehicle?:   VehicleRow;
  documents?: { cr_url: string | null; insurance_url: string | null } | null;
}

const CURRENT_YEAR = new Date().getFullYear();

const INSURANCE_HELP =
  "Hire Insurance: vehicle is licensed and insured for commercial rental, the safe choice. " +
  "Private (P-number): owner's personal insurance, may not cover rental usage. Renters check this, be honest.";

const FUEL_POLICY_HELP =
  "Full-to-Full: renter picks up with a full tank, returns with a full tank (the standard, most common). " +
  "Same-to-Same: renter returns the car at whatever fuel level they received it.";

const MONTHLY_RATE_HELP =
  "Optional discounted package for renters booking 28+ days. Typically 25–30% off (daily × 30). " +
  "Leave blank if you don't offer monthly rates.";

// Starter selection for brand-new listings (edit keeps whatever was saved).
const FEATURES_STARTER = ["AC", "Bluetooth audio", "Reverse camera", "USB charging"];

// Seed the structured km fields. Older rows only have the free-text
// mileage_limit ("Unlimited" / "150 km/day"), so parse that before falling
// back to the wizard's default (100 km/day) — otherwise a plain re-save
// would silently rewrite a legacy allowance.
function seedKmFields(v?: VehicleRow): { unlimited: boolean; included: string } {
  if (!v) return { unlimited: false, included: "100" };
  if (v.unlimited_km) return { unlimited: true, included: "" };
  if (v.included_km_per_day != null) return { unlimited: false, included: String(v.included_km_per_day) };
  const legacy = v.mileage_limit ?? "";
  if (/unlimited/i.test(legacy)) return { unlimited: true, included: "" };
  const m = legacy.match(/(\d+)/);
  return { unlimited: false, included: m ? m[1] : "100" };
}

export function VehicleForm({ agencyId, agencyCity, vehicle, documents }: Props) {
  const router  = useRouter();
  const editing = vehicle !== undefined;

  const [make, setMake]                   = useState(vehicle?.make ?? "");
  const [model, setModel]                 = useState(vehicle?.model ?? "");
  const [year, setYear]                   = useState<number | "">(vehicle?.year ?? CURRENT_YEAR - 3);
  const [yearError, setYearError]         = useState<string | null>(null);
  const [color, setColor]                 = useState(vehicle?.color ?? "");
  const [plateNumber, setPlateNumber]     = useState(vehicle?.plate_number ?? "");
  const [insuranceType, setInsuranceType] = useState<InsuranceType>(vehicle?.insurance_type ?? "hire");
  const [fuelPolicy, setFuelPolicy]       = useState<FuelPolicy>(vehicle?.fuel_policy ?? "full_to_full");
  const [dailyRate, setDailyRate]         = useState(vehicle?.daily_rate_lkr.toString() ?? "");
  const [monthlyRate, setMonthlyRate]     = useState(vehicle?.monthly_rate_lkr?.toString() ?? "");
  const [deposit, setDeposit]             = useState(vehicle?.deposit_lkr?.toString() ?? "");
  const [seats, setSeats]                 = useState(vehicle?.seats ?? 5);
  const [transmission, setTransmission]   = useState(vehicle?.transmission ?? "automatic");
  const [city, setCity]                   = useState(vehicle?.city ?? agencyCity);

  // ── verticals + rental options (migration 039) ──
  const [vehicleType, setVehicleType]     = useState<VehicleType>(vehicle?.vehicle_type ?? "car");
  const [fuelType, setFuelType]           = useState(vehicle?.fuel_type ?? "");
  const [luggage, setLuggage]             = useState(vehicle?.luggage?.toString() ?? "");
  const [selfDrive, setSelfDrive]         = useState(vehicle?.self_drive ?? true);
  const [withDriver, setWithDriver]       = useState(vehicle?.with_driver ?? false);
  const [airportPickup, setAirportPickup] = useState(vehicle?.airport_pickup ?? false);
  const [dailyRateUsd, setDailyRateUsd]   = useState(vehicle?.daily_rate_usd?.toString() ?? "");
  const [extraMileage, setExtraMileage]   = useState(vehicle?.extra_mileage_lkr?.toString() ?? "");
  const [rules, setRules]                 = useState<string[]>(vehicle?.rules ?? []);

  // ── vehicle identity extras (Terms Engine, optional) ──
  const [bodyType, setBodyType]     = useState(vehicle?.body_type ?? "");
  const [variant, setVariant]       = useState(vehicle?.variant ?? "");
  const [doors, setDoors]           = useState(vehicle?.doors?.toString() ?? "");
  const [engineCc, setEngineCc]     = useState(vehicle?.engine_cc?.toString() ?? "");
  const [odometerKm, setOdometerKm] = useState(vehicle?.odometer_km?.toString() ?? "");

  // ── rental terms (Terms Engine) — same SL defaults as the wizard ──
  const kmSeed = seedKmFields(vehicle);
  const [weeklyRate, setWeeklyRate]               = useState(vehicle?.weekly_rate_lkr?.toString() ?? "");
  const [includedKmPerDay, setIncludedKmPerDay]   = useState(kmSeed.included);
  const [unlimitedKm, setUnlimitedKm]             = useState(kmSeed.unlimited);
  const [deliveryAvailable, setDeliveryAvailable] = useState(vehicle?.delivery_available ?? false);
  const [deliveryFee, setDeliveryFee]             = useState(vehicle?.delivery_fee_lkr?.toString() ?? "");
  const [minRentalDays, setMinRentalDays]         = useState(vehicle?.min_rental_days?.toString() ?? "1");
  const [maxRentalDays, setMaxRentalDays]         = useState(vehicle?.max_rental_days?.toString() ?? "");

  const [cleaningFee, setCleaningFee]         = useState(vehicle?.cleaning_fee_lkr?.toString() ?? "5000");
  const [refuelFee, setRefuelFee]             = useState(vehicle?.refuel_fee_lkr?.toString() ?? "1000");
  const [lateFeePerHour, setLateFeePerHour]   = useState(vehicle?.late_fee_per_hour_lkr?.toString() ?? "");

  const [smokingAllowed, setSmokingAllowed]           = useState(vehicle?.smoking_allowed ?? false);
  const [petsAllowed, setPetsAllowed]                 = useState(vehicle?.pets_allowed ?? false);
  const [rideHailAllowed, setRideHailAllowed]         = useState(vehicle?.ride_hail_allowed ?? false);
  const [secondDriverAllowed, setSecondDriverAllowed] = useState(vehicle?.second_driver_allowed ?? true);
  const [restrictedUse, setRestrictedUse]             = useState<string[]>(vehicle?.restricted_use ?? []);

  const [minRenterAge, setMinRenterAge]         = useState(vehicle?.min_renter_age?.toString() ?? "23");
  const [minLicenseYears, setMinLicenseYears]   = useState(vehicle?.min_license_years?.toString() ?? "2");

  const [hasGpsTracker, setHasGpsTracker] = useState(vehicle?.has_gps_tracker ?? false);
  const [hasEtcTag, setHasEtcTag]         = useState(vehicle?.has_etc_tag ?? false);

  const [perKmRate, setPerKmRate]         = useState(vehicle?.per_km_rate_lkr?.toString() ?? "");
  const [tollsIncluded, setTollsIncluded] = useState<boolean | null>(vehicle?.tolls_included ?? null);
  const [driverBata, setDriverBata]       = useState(vehicle?.driver_bata_lkr?.toString() ?? "");

  // ── document proof (CR + insurance), private, admin-reviewed ──
  const [crUrl, setCrUrl]               = useState<string | null>(documents?.cr_url ?? null);
  const [insuranceUrl, setInsuranceUrl] = useState<string | null>(documents?.insurance_url ?? null);
  const [crFile, setCrFile]             = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  const [features, setFeatures] = useState<string[]>(
    vehicle?.features ?? (editing ? [] : FEATURES_STARTER)
  );
  const [description, setDescription] = useState(vehicle?.description ?? "");

  const [existingPhotos, setExistingPhotos] = useState<string[]>(vehicle?.photos ?? []);
  // Each new photo keeps a stable preview URL created once (when picked), not
  // re-created on every render, that re-creation, plus clearing the input
  // value, was leaving the preview blank.
  const [newPhotos, setNewPhotos]           = useState<{ file: File; url: string }[]>([]);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function validateYear(y: number | ""): string | null {
    if (y === "" || Number.isNaN(y)) return "Year is required.";
    const s = String(y);
    if (s.length !== 4) return "Year must be 4 digits (e.g. 2018).";
    if (y < 1990) return "Year must be 1990 or later.";
    if (y > CURRENT_YEAR + 1) return `Year can't be later than ${CURRENT_YEAR + 1}.`;
    return null;
  }

  function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const items = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setNewPhotos((prev) => [...prev, ...items]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const yErr = validateYear(year);
    if (yErr) { setYearError(yErr); return; }

    setLoading(true);

    const supabase = createClient();
    const uploadedUrls: string[] = [];
    const failedFiles: string[]  = [];

    // Upload each new photo. If one fails, log it and continue with the rest
    //, user will see a summary after the save. The sign endpoint roots the
    // R2 key at the caller's agency-id automatically, no agencyId needed
    // client-side.
    for (const { file } of newPhotos) {
      try {
        const out = await uploadToR2("vehicle-photos", file);
        uploadedUrls.push(out.publicUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "upload failed";
        console.error("[vehicle photo upload]", file.name, msg);
        failedFiles.push(`${file.name}: ${msg}`);
      }
    }

    if (failedFiles.length > 0 && uploadedUrls.length === 0 && newPhotos.length > 0) {
      setError(`All photo uploads failed:\n${failedFiles.join("\n")}`);
      setLoading(false);
      return;
    }

    try {
      const cleanFeatures = Array.from(new Set(features.map((s) => s.trim()).filter(Boolean)));
      const cleanRules    = Array.from(new Set(rules.map((s) => s.trim()).filter(Boolean)));

      const allPhotos = [...existingPhotos, ...uploadedUrls];

      // Derived for backward compatibility: existing listing pages still read
      // the legacy free-text mileage_limit column, so we keep it in sync with
      // the structured fields (same derivation as the wizard).
      const mileageLimitDerived = unlimitedKm
        ? "Unlimited"
        : (includedKmPerDay ? `${Number(includedKmPerDay)} km/day` : null);

      const payload = {
        make:           make.trim(),
        model:          model.trim(),
        year:           Number(year),
        color:          color.trim() || null,
        plate_number:   plateNumber.trim() || null,
        insurance_type: insuranceType,
        fuel_policy:    fuelPolicy,
        daily_rate_lkr:  Number(dailyRate),
        daily_rate_usd:  dailyRateUsd ? Number(dailyRateUsd) : null,
        monthly_rate_lkr: monthlyRate ? Number(monthlyRate) : null,
        deposit_lkr:    Number(deposit) || 0,
        seats,
        transmission,
        city,
        vehicle_type:   vehicleType,
        fuel_type:      fuelType || null,
        luggage:        luggage ? Number(luggage) : null,
        self_drive:     selfDrive,
        with_driver:    withDriver,
        airport_pickup: airportPickup,
        mileage_limit:  mileageLimitDerived,
        extra_mileage_lkr: extraMileage ? Number(extraMileage) : null,
        rules:          cleanRules,
        features:       cleanFeatures.length ? cleanFeatures : null,
        description:    description.trim() || null,
        photos:         allPhotos.length ? allPhotos : null,
        // ── vehicle identity extras ──
        body_type:   bodyType || null,
        variant:     variant.trim() || null,
        doors:       doors ? Number(doors) : null,
        engine_cc:   engineCc ? Number(engineCc) : null,
        odometer_km: odometerKm ? Number(odometerKm) : null,
        // ── rental terms ──
        weekly_rate_lkr: weeklyRate ? Number(weeklyRate) : null,
        included_km_per_day: unlimitedKm ? null : (includedKmPerDay ? Number(includedKmPerDay) : null),
        unlimited_km: unlimitedKm,
        delivery_available: deliveryAvailable,
        delivery_fee_lkr: deliveryAvailable && deliveryFee ? Number(deliveryFee) : null,
        min_rental_days: Math.max(minRentalDays ? Number(minRentalDays) : 1, 1),
        max_rental_days: maxRentalDays ? Number(maxRentalDays) : null,
        // ── deposit & fees ──
        cleaning_fee_lkr: clamp(cleaningFee ? Number(cleaningFee) : 5000, 0, 10000),
        refuel_fee_lkr: refuelFee ? Number(refuelFee) : 1000,
        late_fee_per_hour_lkr: lateFeePerHour ? Number(lateFeePerHour) : null,
        // ── house rules ──
        smoking_allowed: smokingAllowed,
        pets_allowed: petsAllowed,
        ride_hail_allowed: rideHailAllowed,
        second_driver_allowed: secondDriverAllowed,
        restricted_use: restrictedUse,
        // ── renter requirements ──
        min_renter_age: clamp(minRenterAge ? Number(minRenterAge) : 23, 18, 40),
        min_license_years: minLicenseYears ? Number(minLicenseYears) : 2,
        // ── disclosures ──
        has_gps_tracker: hasGpsTracker,
        has_etc_tag: hasEtcTag,
        // ── with-driver terms ──
        per_km_rate_lkr: withDriver && perKmRate ? Number(perKmRate) : null,
        tolls_included: withDriver ? tollsIncluded : null,
        driver_bata_lkr: withDriver && driverBata ? Number(driverBata) : null,
      };

      // Upload any new document proof (CR / insurance) to private storage.
      let newCrUrl = crUrl;
      let newInsuranceUrl = insuranceUrl;
      if (crFile)        { newCrUrl        = (await uploadToR2("vehicle-docs", crFile)).publicUrl; }
      if (insuranceFile) { newInsuranceUrl = (await uploadToR2("vehicle-docs", insuranceFile)).publicUrl; }

      let savedVehicleId: string;
      if (editing) {
        const { error: updateError } = await supabase
          .from("vehicles")
          .update(payload)
          .eq("id", vehicle!.id);

        if (updateError) throw new Error(updateError.message);
        savedVehicleId = vehicle!.id;
      } else {
        const slug = `${buildVehicleSlug(make, model, city, Number(year))}-${crypto.randomUUID().slice(0, 6)}`;
        // New listings start in admin review and are not public yet.
        const { data: inserted, error: insertError } = await supabase
          .from("vehicles")
          .insert({ ...payload, agency_id: agencyId, slug, status: "pending_review" })
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);
        savedVehicleId = (inserted as { id: string }).id;
      }

      // Save document proof (private table, owner + admin only).
      if (newCrUrl || newInsuranceUrl) {
        const { error: docError } = await supabase
          .from("vehicle_documents")
          .upsert({ vehicle_id: savedVehicleId, cr_url: newCrUrl, insurance_url: newInsuranceUrl }, { onConflict: "vehicle_id" });
        if (docError) console.error("[vehicle documents]", docError.message);
      }

      if (failedFiles.length > 0) {
        // Saved partial, tell the user which photos didn't make it.
        alert(`Vehicle saved, but ${failedFiles.length} photo(s) failed to upload:\n${failedFiles.join("\n")}\nTry uploading those again.`);
      }

      router.push("/dashboard/vehicles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">

      <div className="grid grid-cols-2 gap-4">
        <Field label="Make" required>
          <input type="text" value={make} onChange={(e) => setMake(e.target.value)} required placeholder="Toyota" list="sl-makes-edit" className={inputClass} />
          <datalist id="sl-makes-edit">
            {SL_MAKES.map((m) => <option key={m} value={m} />)}
          </datalist>
        </Field>
        <Field label="Model" required>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required placeholder="Aqua" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Year" required error={yearError}>
          <input
            type="number"
            value={year}
            onChange={(e) => {
              const v = e.target.value;
              setYear(v === "" ? "" : Number(v));
              if (yearError) setYearError(null);
            }}
            onBlur={() => setYearError(validateYear(year))}
            required
            placeholder="2018"
            className={inputClass}
          />
        </Field>
        <Field label="Color">
          <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Pearl White" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Body type" hint="Optional">
          <Select value={bodyType} onChange={setBodyType} options={BODY_TYPE_OPTIONS} placeholder="Select…" />
        </Field>
        <Field label="Variant" hint="Optional trim, e.g. GLi, Hybrid">
          <input type="text" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="GLi, Hybrid, etc." className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Doors" hint="Optional">
          <input type="number" value={doors} onChange={(e) => setDoors(e.target.value)} min={1} max={6} placeholder="4" className={inputClass} />
        </Field>
        <Field label="Engine (cc)" hint="Optional">
          <input type="number" value={engineCc} onChange={(e) => setEngineCc(e.target.value)} min={0} placeholder="1500" className={inputClass} />
        </Field>
        <Field label="Odometer (km)" hint="Optional">
          <input type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} min={0} placeholder="65000" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Vehicle type" required hint="Search category.">
          <Select value={vehicleType} onChange={(v) => setVehicleType(v as VehicleType)} options={VEHICLE_TYPE_OPTIONS} />
        </Field>
        <Field label="Fuel type" hint="Shown to tourists.">
          <Select value={fuelType} onChange={setFuelType} options={FUEL_TYPE_OPTIONS} />
        </Field>
        <Field label="Luggage (bags)" hint="Large bags it fits">
          <input type="number" value={luggage} onChange={(e) => setLuggage(e.target.value)} min={0} max={20} placeholder="2" className={inputClass} />
        </Field>
      </div>

      <div>
        <span className="text-slate-600 text-xs mb-1.5 flex items-center">
          Rental options <span className="text-blue-600 ml-0.5">*</span>
          <HelpHint text="Pick every way a customer can rent this vehicle. At least one must be on." />
        </span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Self-drive",     on: selfDrive,     set: setSelfDrive },
            { label: "With driver",    on: withDriver,    set: setWithDriver },
            { label: "Airport pickup", on: airportPickup, set: setAirportPickup },
          ].map(({ label, on, set }) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!on)}
              className={`px-2 py-2.5 text-xs rounded-xl border font-semibold text-center transition-all ${
                on ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Insurance type"
        required
        help={INSURANCE_HELP}
        hint="Hire-insured vehicles are listed first."
      >
        <Select
          value={insuranceType}
          onChange={(v) => setInsuranceType(v as InsuranceType)}
          options={INSURANCE_OPTIONS}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Daily rate (LKR)" required>
          <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} required min={500} step={100} placeholder="6500" className={inputClass} />
        </Field>
        <Field label="Monthly rate (LKR)" help={MONTHLY_RATE_HELP} hint="Optional package price">
          <input type="number" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} min={0} step={1000} placeholder="120000" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Refundable deposit (LKR)" hint="Optional, held by you, refunded after return">
          <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} min={0} step={1000} placeholder="0" className={inputClass} />
        </Field>
        <Field label="Daily rate (USD)" hint="Optional, shown to tourists. Auto-estimated if blank.">
          <input type="number" value={dailyRateUsd} onChange={(e) => setDailyRateUsd(e.target.value)} min={0} step={1} placeholder="30" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Seats">
          <input type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value))} min={2} max={15} className={inputClass} />
        </Field>
        <Field label="Transmission">
          <Select
            value={transmission}
            onChange={setTransmission}
            options={TRANSMISSION_OPTIONS}
          />
        </Field>
        <Field label="Fuel policy" help={FUEL_POLICY_HELP}>
          <Select
            value={fuelPolicy}
            onChange={(v) => setFuelPolicy(v as FuelPolicy)}
            options={FUEL_POLICY_OPTIONS}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="City" required>
          <Select
            value={city}
            onChange={setCity}
            options={CITY_OPTIONS}
          />
        </Field>
        <Field label="Plate number" hint="Visible only to confirmed renters">
          <input type="text" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="WP CAB-1234" className={inputClass} />
        </Field>
      </div>

      {/* ── Rental terms (Terms Engine), mirrors the listing wizard's step ── */}
      <div className="pt-4 border-t border-slate-200 space-y-5">
        <div>
          <h3 className="text-slate-900 text-sm font-bold">Rental terms</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            These become part of every booking&apos;s rental agreement. Standard Sri Lankan defaults are pre-filled — change only what&apos;s different for this vehicle.
          </p>
        </div>

        {/* Pricing extras */}
        <div className="space-y-3">
          <TermsHeading>Pricing extras</TermsHeading>
          <Field label="Weekly rate (LKR)" hint="Optional package price for 7+ day bookings">
            <input type="number" value={weeklyRate} onChange={(e) => setWeeklyRate(e.target.value)} min={0} step={500} placeholder="40000" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Included km/day" hint={unlimitedKm ? "Unlimited km is on" : "Extra km beyond this is charged"}>
              <input type="number" value={unlimitedKm ? "" : includedKmPerDay} onChange={(e) => setIncludedKmPerDay(e.target.value)}
                disabled={unlimitedKm} min={0} placeholder={unlimitedKm ? "Unlimited" : "100"} className={inputClass} />
            </Field>
            <Field label="Extra km charge (LKR/km)" hint="Charge beyond the allowance">
              <input type="number" value={extraMileage} onChange={(e) => setExtraMileage(e.target.value)} min={0} step={5} placeholder="30" className={inputClass} />
            </Field>
          </div>
          <ToggleRow label="Unlimited km" on={unlimitedKm} onChange={setUnlimitedKm} />
          <ToggleRow label="Delivery available" hint="Deliver the vehicle to the renter for a fee" on={deliveryAvailable} onChange={setDeliveryAvailable} />
          {deliveryAvailable && (
            <Field label="Delivery fee (LKR)">
              <input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} min={0} placeholder="1500" className={inputClass} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min rental days">
              <input type="number" value={minRentalDays} onChange={(e) => setMinRentalDays(e.target.value)} min={1} className={inputClass} />
            </Field>
            <Field label="Max rental days" hint="Optional, blank = no limit">
              <input type="number" value={maxRentalDays} onChange={(e) => setMaxRentalDays(e.target.value)} min={1} placeholder="No limit" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Fees (deposit lives above, next to the daily rate) */}
        <div className="space-y-3">
          <TermsHeading>Fees</TermsHeading>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cleaning fee (LKR)" hint="If returned excessively dirty, up to Rs. 10,000">
              <input type="number" value={cleaningFee} onChange={(e) => setCleaningFee(e.target.value)} min={0} max={10000} step={500} className={inputClass} />
            </Field>
            <Field label="Refuel service fee (LKR)">
              <input type="number" value={refuelFee} onChange={(e) => setRefuelFee(e.target.value)} min={0} step={100} className={inputClass} />
            </Field>
          </div>
          <Field label="Late fee per hour (LKR)" hint="Optional, blank = daily rate ÷ 8 per hour">
            <input type="number" value={lateFeePerHour} onChange={(e) => setLateFeePerHour(e.target.value)} min={0} placeholder="auto: daily rate ÷ 8" className={inputClass} />
          </Field>
        </div>

        {/* House rules */}
        <div className="space-y-2">
          <TermsHeading>House rules</TermsHeading>
          <ToggleRow label="Smoking allowed" on={smokingAllowed} onChange={setSmokingAllowed} />
          <ToggleRow label="Pets allowed" on={petsAllowed} onChange={setPetsAllowed} />
          <ToggleRow label="Ride-hail / commercial use allowed" on={rideHailAllowed} onChange={setRideHailAllowed} />
          <ToggleRow label="Second driver allowed" on={secondDriverAllowed} onChange={setSecondDriverAllowed} />
          <div className="pt-1">
            <span className="text-slate-600 text-xs mb-1.5 block">Not allowed:</span>
            <div className="flex flex-wrap gap-1.5">
              {RESTRICTED_USE_OPTIONS.map(({ value, label }) => {
                const on = restrictedUse.includes(value);
                return (
                  <button key={value} type="button"
                    onClick={() => setRestrictedUse((r) => on ? r.filter((v) => v !== value) : [...r, value])}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${on ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {on && <Check size={11} />} {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Renter requirements */}
        <div className="space-y-3">
          <TermsHeading>Renter requirements</TermsHeading>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min age">
              <input type="number" value={minRenterAge} onChange={(e) => setMinRenterAge(e.target.value)} min={18} max={40} className={inputClass} />
            </Field>
            <Field label="Min years holding licence">
              <input type="number" value={minLicenseYears} onChange={(e) => setMinLicenseYears(e.target.value)} min={0} className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Disclosures */}
        <div className="space-y-2">
          <TermsHeading>Disclosures</TermsHeading>
          <ToggleRow label="GPS tracker fitted" hint="Disclosed to renters in the rental agreement, as required" on={hasGpsTracker} onChange={setHasGpsTracker} />
          <ToggleRow label="ETC expressway tag fitted" hint="Tag charges during a rental are billed to the renter" on={hasEtcTag} onChange={setHasEtcTag} />
        </div>

        {/* With-driver terms */}
        {withDriver && (
          <div className="space-y-3">
            <TermsHeading>With-driver terms</TermsHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Per-km rate (LKR)" hint="Optional">
                <input type="number" value={perKmRate} onChange={(e) => setPerKmRate(e.target.value)} min={0} placeholder="60" className={inputClass} />
              </Field>
              <Field label="Driver overnight allowance (Rs/night)">
                <input type="number" value={driverBata} onChange={(e) => setDriverBata(e.target.value)} min={0} placeholder="2000" className={inputClass} />
              </Field>
            </div>
            <div>
              <span className="text-slate-600 text-xs mb-1.5 block">Tolls included in price?</span>
              <div className="grid grid-cols-2 gap-2">
                {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => (
                  <button key={l} type="button" onClick={() => setTollsIncluded(v)}
                    className={`py-2.5 rounded-xl border font-semibold text-xs transition-all ${tollsIncluded === v ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <span className="text-slate-600 text-xs mb-1.5 block">Features</span>
        <PresetPicker presets={FEATURE_PRESETS} value={features} onChange={setFeatures} addPlaceholder="Add another feature" />
        <span className="text-slate-500 text-xs mt-1.5 block">
          Tap everything this vehicle has. Features only, no ads or contact info, listings with non-feature content are rejected in review.
        </span>
      </div>

      <div>
        <span className="text-slate-600 text-xs mb-1.5 block">Handover rules</span>
        <PresetPicker presets={RULE_PRESETS} value={rules} onChange={setRules} addPlaceholder="Add your own rule" />
        <span className="text-slate-500 text-xs mt-1.5 block">
          Tap the rules that apply. Shown to renters on the listing with matching icons.
        </span>
      </div>

      <Field
        label="Description"
        hint="Free-form prose: pickup notes, what's included (child seat? delivery?), why renters love this car. Reviewed by admins, keep it factual."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Free pickup within Colombo city limits. Child seat available on request. Recently serviced, clean and well-maintained."
          className={`${inputClass} resize-none`}
        />
        <span className="text-slate-400 text-xs mt-1 block">{description.length}/1000</span>
      </Field>

      {/* Photo dropzone, rendered as a plain <div>, NOT inside a <label>.
          Wrapping a hidden file input + a button in the same <label> causes
          the browser to forward clicks twice (once via label, once via the
          button's onClick), which on some platforms makes the second pick
          silently fail. Keeping these as siblings in a div sidesteps it. */}
      <div>
        <span className="text-slate-600 text-xs mb-1 block">Photos</span>

        {/* Native <label htmlFor> association, opens the file picker reliably
            every time, including after the user cancels the dialog. (The old
            hidden-input + programmatic .click() approach only opened once.) */}
        <input
          id="vehicle-photo-input"
          type="file" accept="image/*" multiple
          onChange={(e) => {
            addPhotos(e.target.files);
            // Clear so the same file can be re-picked next time
            e.target.value = "";
          }}
          className="sr-only"
          aria-label="Add photos"
        />
        <label
          htmlFor="vehicle-photo-input"
          className="block w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-100/60 transition-colors"
        >
          <Camera size={28} className="mx-auto mb-2 text-slate-600" strokeWidth={1.75} />
          <p className="text-slate-700 text-sm font-medium">
            Click to {newPhotos.length || existingPhotos.length ? "add more photos" : "select photos"}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">JPG or PNG · multiple allowed</p>
        </label>

        <p className="text-slate-500 text-xs mt-1">
          First photo becomes the cover. Add 3+ for better visibility. Photos upload when you save the form.
        </p>

        {(existingPhotos.length > 0 || newPhotos.length > 0) && (
          <>
            <p className="text-slate-600 text-xs mt-3">
              {existingPhotos.length + newPhotos.length} photo{existingPhotos.length + newPhotos.length === 1 ? "" : "s"} selected
              {newPhotos.length > 0 && ` · ${newPhotos.length} pending upload`}
            </p>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {existingPhotos.map((url, i) => (
                <PhotoThumb
                  key={`exist-${url}`} src={url}
                  isCover={i === 0}
                  onRemove={() => setExistingPhotos((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
              {newPhotos.map((item, i) => (
                <PhotoThumb
                  key={item.url}
                  src={item.url}
                  isCover={existingPhotos.length === 0 && i === 0}
                  isPending
                  onRemove={() => {
                    URL.revokeObjectURL(item.url);
                    setNewPhotos((prev) => prev.filter((_, j) => j !== i));
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Document proof, private, for admin verification only */}
      <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <span className="text-slate-700 text-sm font-semibold block">Document proof <span className="text-slate-400 font-normal">(optional, private)</span></span>
          <span className="text-slate-500 text-xs">
            Optional now — upload the vehicle registration (CR) and insurance certificate to earn the <strong>Verified Vehicle</strong> badge (better ranking, more bookings). We&apos;ll also ask before your first confirmed booking. Only DriveLink admins see these.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DocUpload label="Registration (CR)" url={crUrl} file={crFile} onPick={setCrFile} onClear={() => { setCrFile(null); setCrUrl(null); }} />
          <DocUpload label="Insurance certificate" url={insuranceUrl} file={insuranceFile} onPick={setInsuranceFile} onClear={() => { setInsuranceFile(null); setInsuranceUrl(null); }} />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} size="lg">
          {loading
            ? (newPhotos.length ? `Uploading ${newPhotos.length} photo${newPhotos.length === 1 ? "" : "s"}…` : "Saving…")
            : (editing ? "Save changes" : "List vehicle")}
        </Button>
        <Button
          type="button" variant="ghost" size="lg"
          onClick={() => router.push("/dashboard/vehicles")}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500";

function TermsHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-700 text-xs font-bold uppercase tracking-wide">{children}</p>;
}

// Compact switch row, same interaction as the wizard's ToggleField, scaled to
// this form's denser layout.
function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${on ? "bg-blue-50 border-blue-500" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
      <span>
        <span className={`block text-xs font-semibold ${on ? "text-blue-700" : "text-slate-700"}`}>{label}</span>
        {hint && <span className="block text-slate-400 text-[11px] mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${on ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function DocUpload({
  label, url, file, onPick, onClear,
}: {
  label:   string;
  url:     string | null;
  file:    File | null;
  onPick:  (f: File) => void;
  onClear: () => void;
}) {
  const inputId = useId();
  const has = !!file || !!url;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-slate-700 text-xs font-medium mb-2">{label}</p>
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
      {has ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
            <Check size={12} /> {file ? file.name : "Uploaded"}
          </span>
          {url && !file && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700">View</a>
          )}
          <button type="button" onClick={onClear} className="text-slate-400 hover:text-rose-600 ml-auto" aria-label="Remove">
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Upload size={13} /> Upload
        </label>
      )}
      <p className="text-slate-400 text-[10px] mt-1.5 inline-flex items-center gap-1"><FileText size={10} /> JPG, PNG or PDF</p>
    </div>
  );
}

function Field({
  label, hint, error, required, help, children,
}: {
  label:     string;
  hint?:     string;
  error?:    string | null;
  required?: boolean;
  help?:     string;
  children:  React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-slate-600 text-xs mb-1 flex items-center">
        {label} {required && <span className="text-blue-600 ml-0.5">*</span>}
        {help && <HelpHint text={help} />}
      </span>
      {children}
      {error
        ? <span className="text-red-400 text-xs mt-1 block">{error}</span>
        : hint && <span className="text-slate-500 text-xs mt-1 block">{hint}</span>}
    </label>
  );
}

function PhotoThumb({
  src, isCover, isPending, onRemove,
}: {
  src:       string;
  isCover?:  boolean;
  isPending?: boolean;
  onRemove:  () => void;
}) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
      {isPending ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <Image src={src} alt="" fill className="object-cover" sizes="120px" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-stone-900/70 hover:bg-red-500 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition flex items-center justify-center"
        aria-label="Remove photo"
      >
        <X size={14} />
      </button>
      {isCover && (
        <span className="absolute bottom-1 left-1 text-[10px] bg-blue-600 text-white font-semibold px-1.5 py-0.5 rounded">
          Cover
        </span>
      )}
      {isPending && (
        <span className="absolute bottom-1 right-1 text-[10px] bg-stone-900/80 text-blue-200 px-1.5 py-0.5 rounded">
          New
        </span>
      )}
    </div>
  );
}
