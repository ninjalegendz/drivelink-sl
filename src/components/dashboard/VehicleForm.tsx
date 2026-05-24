"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Button } from "@/components/ui/Button";
import { HelpHint } from "@/components/ui/HelpHint";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";
import { buildVehicleSlug } from "@/lib/vehicles/slug";
import type { Database, InsuranceType, FuelPolicy } from "@/types/database";

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
}

const CURRENT_YEAR = new Date().getFullYear();

const INSURANCE_HELP =
  "Hire Insurance: vehicle is licensed and insured for commercial rental — the safe choice. " +
  "Private (P-number): owner's personal insurance, may not cover rental usage. Renters check this — be honest.";

const FUEL_POLICY_HELP =
  "Full-to-Full: renter picks up with a full tank, returns with a full tank (the standard, most common). " +
  "Same-to-Same: renter returns the car at whatever fuel level they received it.";

const MONTHLY_RATE_HELP =
  "Optional discounted package for renters booking 28+ days. Typically 25–30% off (daily × 30). " +
  "Leave blank if you don't offer monthly rates.";

const FEATURES_TEMPLATE = `AC
Bluetooth audio
Reverse camera
USB charging
Power windows
Power steering`;

export function VehicleForm({ agencyId, agencyCity, vehicle }: Props) {
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

  const [featuresText, setFeaturesText] = useState(
    vehicle?.features?.join("\n") ?? (editing ? "" : FEATURES_TEMPLATE)
  );
  const [description, setDescription] = useState(vehicle?.description ?? "");

  const [existingPhotos, setExistingPhotos] = useState<string[]>(vehicle?.photos ?? []);
  const [newPhotos, setNewPhotos]           = useState<File[]>([]);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setNewPhotos((prev) => [...prev, ...Array.from(files)]);
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
    // — user will see a summary after the save. The sign endpoint roots the
    // R2 key at the caller's agency-id automatically — no agencyId needed
    // client-side.
    for (const file of newPhotos) {
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
      const features = Array.from(
        new Set(
          featuresText
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      );

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
        monthly_rate_lkr: monthlyRate ? Number(monthlyRate) : null,
        deposit_lkr:    Number(deposit) || 0,
        seats,
        transmission,
        city,
        features:       features.length ? features : null,
        description:    description.trim() || null,
        photos:         allPhotos.length ? allPhotos : null,
      };

      if (editing) {
        const { error: updateError } = await supabase
          .from("vehicles")
          .update(payload)
          .eq("id", vehicle!.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const slug = `${buildVehicleSlug(make, model, city, Number(year))}-${crypto.randomUUID().slice(0, 6)}`;
        // New listings start in admin review and are not public yet.
        const { error: insertError } = await supabase
          .from("vehicles")
          .insert({ ...payload, agency_id: agencyId, slug, status: "pending_review" });

        if (insertError) throw new Error(insertError.message);
      }

      if (failedFiles.length > 0) {
        // Saved partial — tell the user which photos didn't make it.
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
          <input type="text" value={make} onChange={(e) => setMake(e.target.value)} required placeholder="Toyota" className={inputClass} />
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

      <Field label="Refundable deposit (LKR)" hint="Optional — held by you, refunded after return">
        <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} min={0} step={1000} placeholder="0" className={inputClass} />
      </Field>

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

      <Field
        label="Features"
        hint="One feature per line. Features only — no advertisements, contact info, or promotional copy. Listings with non-feature content will be rejected during review."
      >
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={6}
          className={`${inputClass} resize-none font-mono text-xs`}
        />
      </Field>

      <Field
        label="Description"
        hint="Free-form prose: pickup notes, what's included (child seat? delivery?), why renters love this car. Reviewed by admins — keep it factual."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Free pickup within Colombo city limits. Child seat available on request. Recently serviced — clean and well-maintained."
          className={`${inputClass} resize-none`}
        />
        <span className="text-slate-600 text-xs mt-1 block">{description.length}/1000</span>
      </Field>

      {/* Photo dropzone — rendered as a plain <div>, NOT inside a <label>.
          Wrapping a hidden file input + a button in the same <label> causes
          the browser to forward clicks twice (once via label, once via the
          button's onClick), which on some platforms makes the second pick
          silently fail. Keeping these as siblings in a div sidesteps it. */}
      <div>
        <span className="text-slate-400 text-xs mb-1 block">Photos</span>

        <input
          ref={fileInputRef}
          type="file" accept="image/*" multiple
          onChange={(e) => {
            addPhotos(e.target.files);
            // Clear so the same file can be re-picked next time
            e.target.value = "";
          }}
          className="sr-only"
          aria-label="Add photos"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-amber-500 hover:bg-slate-800/40 focus:border-amber-500 focus:outline-none transition-colors"
        >
          <Camera size={28} className="mx-auto mb-2 text-slate-400" strokeWidth={1.75} />
          <p className="text-slate-300 text-sm font-medium">
            Click to {newPhotos.length || existingPhotos.length ? "add more photos" : "select photos"}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">JPG or PNG · multiple allowed</p>
        </button>

        <p className="text-slate-500 text-xs mt-1">
          First photo becomes the cover. Add 3+ for better visibility. Photos upload when you save the form.
        </p>

        {(existingPhotos.length > 0 || newPhotos.length > 0) && (
          <>
            <p className="text-slate-400 text-xs mt-3">
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
              {newPhotos.map((file, i) => (
                <PhotoThumb
                  key={`new-${i}-${file.name}-${file.size}`}
                  src={URL.createObjectURL(file)}
                  isCover={existingPhotos.length === 0 && i === 0}
                  isPending
                  onRemove={() => setNewPhotos((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          </>
        )}
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
  "w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500";

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
      <span className="text-slate-400 text-xs mb-1 flex items-center">
        {label} {required && <span className="text-amber-400 ml-0.5">*</span>}
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
    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 group">
      {isPending ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <Image src={src} alt="" fill className="object-cover" sizes="120px" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-stone-900/70 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
        aria-label="Remove photo"
      >
        <X size={14} />
      </button>
      {isCover && (
        <span className="absolute bottom-1 left-1 text-[10px] bg-amber-500 text-stone-900 font-semibold px-1.5 py-0.5 rounded">
          Cover
        </span>
      )}
      {isPending && (
        <span className="absolute bottom-1 right-1 text-[10px] bg-stone-900/80 text-amber-200 px-1.5 py-0.5 rounded">
          New
        </span>
      )}
    </div>
  );
}
