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
import { RULE_PRESETS, FEATURE_PRESETS, MILEAGE_PRESETS, SL_MAKES } from "@/data/vehicle-presets";
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

const STEPS = ["Photos", "Vehicle", "Price", "How to rent", "Rules & docs", "Review"];

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
  const [mileageLimit, setMileageLimit] = useState(prefill?.mileage_limit ?? "");
  const [rules, setRules] = useState<string[]>(prefill?.rules ?? []);
  const [features, setFeatures] = useState<string[]>(prefill?.features ?? []);
  const [description, setDescription] = useState(prefill?.description ?? "");

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
        setMileageLimit(d.mileageLimit ?? "");
        // Older drafts stored rules as newline text; migrate them to the chip list.
        setRules(Array.isArray(d.rules) ? d.rules : (d.rulesText ? String(d.rulesText).split("\n").map((s: string) => s.trim()).filter(Boolean) : []));
        setFeatures(Array.isArray(d.features) ? d.features : []);
        setDescription(d.description ?? "");
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const d = { make, model, year, vehicleType, dailyRate, deposit, selfDrive, withDriver, airportPickup, transmission, seats, fuelType, city, insuranceType, mileageLimit, rules, features, description };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }, [make, model, year, vehicleType, dailyRate, deposit, selfDrive, withDriver, airportPickup, transmission, seats, fuelType, city, insuranceType, mileageLimit, rules, features, description]);

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

      const { data: inserted, error: insErr } = await supabase
        .from("vehicles")
        .insert({
          agency_id: agencyId, slug, status: "pending_review",
          make: make.trim(), model: model.trim(), year: Number(year),
          vehicle_type: vehicleType, daily_rate_lkr: Number(dailyRate), deposit_lkr: Number(deposit) || 0,
          self_drive: selfDrive, with_driver: withDriver, airport_pickup: airportPickup,
          transmission, seats, fuel_type: fuelType || null, city,
          insurance_type: insuranceType, mileage_limit: mileageLimit.trim() || null,
          rules: cleanRules, features: cleanFeatures.length ? cleanFeatures : null,
          description: description.trim() || null,
          photos: photoUrls.length ? photoUrls : null,
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
        </div>
      )}

      {/* ── Step 2: Price ── */}
      {step === 2 && (
        <div className="space-y-5">
          <BigField label="Price per day (LKR)">
            <input className={`${bigInput} text-2xl font-bold`} type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="6500" min={500} step={100} />
          </BigField>
          <BigField label="Refundable deposit (LKR)" hint="Held by you, returned after the rental. Leave blank for none.">
            <input className={bigInput} type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" min={0} step={1000} />
          </BigField>
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
            <p className="text-slate-600 text-sm mb-2">Mileage allowance (optional)</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MILEAGE_PRESETS.map((m) => (
                <button key={m} type="button" onClick={() => setMileageLimit(mileageLimit === m ? "" : m)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${mileageLimit === m ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {m}
                </button>
              ))}
            </div>
            <input className={bigInput} value={mileageLimit} onChange={(e) => setMileageLimit(e.target.value)} placeholder="Or type your own, e.g. 120 km/day" />
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
          <div className="grid grid-cols-2 gap-3">
            <DocPick label="Registration (CR)" file={crFile} onPick={setCrFile} />
            <DocPick label="Insurance" file={insuranceFile} onPick={setInsuranceFile} />
          </div>
          <p className="text-slate-400 text-xs">Documents are private, only DriveLink admins see them.</p>
        </div>
      )}

      {/* ── Step 5: Review ── */}
      {step === 5 && (
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
