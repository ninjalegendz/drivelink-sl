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
import { RULE_PRESETS, FEATURE_PRESETS, MILEAGE_PRESETS, SL_MAKES } from "@/data/vehicle-presets";
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
  const [mileageLimit, setMileageLimit]   = useState(vehicle?.mileage_limit ?? "");
  const [extraMileage, setExtraMileage]   = useState(vehicle?.extra_mileage_lkr?.toString() ?? "");
  const [rules, setRules]                 = useState<string[]>(vehicle?.rules ?? []);

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
        mileage_limit:  mileageLimit.trim() || null,
        extra_mileage_lkr: extraMileage ? Number(extraMileage) : null,
        rules:          cleanRules,
        features:       cleanFeatures.length ? cleanFeatures : null,
        description:    description.trim() || null,
        photos:         allPhotos.length ? allPhotos : null,
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Mileage allowance" hint="Pick one or type your own">
          <div className="flex flex-wrap gap-1 mb-1.5">
            {MILEAGE_PRESETS.map((m) => (
              <button key={m} type="button" onClick={() => setMileageLimit(mileageLimit === m ? "" : m)}
                className={`px-2 py-1 rounded-full border text-[11px] font-medium transition-all ${mileageLimit === m ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                {m}
              </button>
            ))}
          </div>
          <input type="text" value={mileageLimit} onChange={(e) => setMileageLimit(e.target.value)} placeholder="100 km/day" className={inputClass} />
        </Field>
        <Field label="Extra mileage (LKR/km)" hint="Charge beyond the allowance">
          <input type="number" value={extraMileage} onChange={(e) => setExtraMileage(e.target.value)} min={0} step={5} placeholder="60" className={inputClass} />
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
          <span className="text-slate-700 text-sm font-semibold block">Document proof <span className="text-slate-400 font-normal">(private)</span></span>
          <span className="text-slate-500 text-xs">
            Upload the vehicle registration (CR) and insurance certificate. Only DriveLink admins see these, they unlock the <strong>Documents Checked</strong> badge.
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
