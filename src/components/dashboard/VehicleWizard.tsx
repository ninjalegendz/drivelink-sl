"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Car, Bus, Bike, ChevronLeft, ChevronRight, ChevronDown, Upload, FileText } from "lucide-react";
import { TukTuk } from "@/components/ui/icons/TukTuk";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Select } from "@/components/ui/Select";
import { PresetPicker } from "@/components/dashboard/PresetPicker";
import { PhotoOrderGrid, movePhotoInList } from "@/components/dashboard/PhotoOrderGrid";
import { SL_CITIES } from "@/data/cities";
import { RULE_PRESETS, FEATURE_PRESETS, SL_MAKES, RESTRICTED_USE_OPTIONS, bodyTypesFor, hasBodyType, makeModelHint } from "@/data/vehicle-presets";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import { buildVehicleSlug } from "@/lib/vehicles/slug";
import { containsPublicContactDetails, PUBLIC_CONTACT_ERROR } from "@/lib/content/public-contact";
import type { VehicleType } from "@/types/database";

const TYPE_TILES: { value: VehicleType; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "car",    label: "Car",     Icon: Car },
  { value: "suv",    label: "SUV",     Icon: Car },
  { value: "van",    label: "Van",     Icon: Bus },
  { value: "bike",   label: "Bike",    Icon: Bike },
  { value: "tuktuk", label: "Tuk-Tuk", Icon: TukTuk },
];
const FUEL_TILES = ["petrol", "diesel", "hybrid", "electric"];
const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));
const CURRENT_YEAR = new Date().getFullYear();
const DRAFT_KEY = "drivelink_vehicle_wizard_draft";
// Decision 10: minimum "core photo set" a listing must have before it can be
// submitted for admin review. Also enforced server-side (vehicle_insert_guard).
const MIN_LISTING_PHOTOS = 4;

// Photos are re-encoded to JPEG before upload and the server only accepts JPEG
// and PNG. Advertising `image/*` invited HEIC straight off an iPhone, which
// failed at the very end of the flow with an unhelpful message.
const PHOTO_ACCEPT = "image/jpeg,image/png";

const MAX_CLEANING_FEE = 10000;
const MIN_RENTER_AGE_FLOOR = 18;
const MIN_RENTER_AGE_CEILING = 40;

// Subset of a vehicles row used to seed the wizard when duplicating an
// existing listing.
//
// This used to carry only the 18 headline columns, so "Duplicate" quietly
// reset the whole terms engine - fees, mileage allowance, delivery, house
// rules, renter requirements, disclosures - back to platform defaults, while
// the banner said everything was pre-filled. Every column that describes the
// *offer* is copied now. Photos, documents, the plate and the odometer stay
// out because they belong to one physical vehicle, not to the offer.
export interface WizardPrefill {
  make: string; model: string; year: number;
  vehicle_type: VehicleType | null;
  daily_rate_lkr: number; deposit_lkr: number | null;
  self_drive: boolean | null; with_driver: boolean | null; airport_pickup: boolean | null;
  transmission: string; seats: number; fuel_type: string | null; city: string;
  insurance_type: "hire" | "private"; mileage_limit: string | null;
  rules: string[] | null; features: string[] | null; description: string | null;
  body_type: string | null; variant: string | null; doors: number | null; engine_cc: number | null;
  weekly_rate_lkr: number | null; included_km_per_day: number | null; unlimited_km: boolean | null;
  extra_mileage_lkr: number | null;
  delivery_available: boolean | null; delivery_fee_lkr: number | null;
  min_rental_days: number | null; max_rental_days: number | null;
  cleaning_fee_lkr: number | null; refuel_fee_lkr: number | null; late_fee_per_hour_lkr: number | null;
  smoking_allowed: boolean | null; pets_allowed: boolean | null; ride_hail_allowed: boolean | null;
  restricted_use: string[] | null;
  min_renter_age: number | null; min_license_years: number | null;
  has_gps_tracker: boolean | null; has_etc_tag: boolean | null;
  per_km_rate_lkr: number | null; tolls_included: boolean | null; driver_bata_lkr: number | null;
}

/** Number column → the wizard's string-backed input, preserving "not set". */
const numText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

interface Props {
  agencyId: string;
  agencyCity: string;
  prefill?: WizardPrefill | null;
  canDeclareListingAuthority: boolean;
  /**
   * Set when a DriveLink admin drafts a listing on an owner's page from what
   * they sent on WhatsApp ("List it for me"). The draft stays private until the
   * owner confirms the right to list it.
   */
  adminDraft?: { pageName: string };
}

// Three steps to go live. The listing used to take six screens, and most of
// what they asked (deposit, km allowance, fees, house rules, features,
// documents) already has a sensible default. Those now sit
// behind "More details" on the last step, where they can be set now or later.
// Doors and engine size stay required on the first step.
const STEPS = ["Your vehicle", "Photos", "Price and go live"];
const LAST_STEP = STEPS.length - 1;
const PHOTOS_STEP = 1;

export function VehicleWizard({ agencyId, agencyCity, prefill, canDeclareListingAuthority, adminDraft }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  // An admin drafts for many pages, so each page keeps its own unfinished draft
  // and never overwrites the admin's own listing draft.
  const draftKey = adminDraft ? `${DRAFT_KEY}:admin:${agencyId}` : DRAFT_KEY;

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
  const [seats, setSeats] = useState<number | "">(prefill?.seats ?? 5);
  const [fuelType, setFuelType] = useState(prefill?.fuel_type ?? "");
  const [city, setCity] = useState(prefill?.city ?? agencyCity);
  // No default. It used to start on "Hire", so an owner with private insurance
  // who never looked at the question advertised commercial cover they lack.
  const [insuranceType, setInsuranceType] = useState<"hire" | "private" | "">(prefill?.insurance_type ?? "");
  const [rules, setRules] = useState<string[]>(prefill?.rules ?? []);
  const [features, setFeatures] = useState<string[]>(prefill?.features ?? []);
  const [description, setDescription] = useState(prefill?.description ?? "");

  // ── Vehicle identity (optional, under More details) ──
  const [bodyType, setBodyType] = useState(prefill?.body_type ?? "");
  const [variant, setVariant] = useState(prefill?.variant ?? "");
  const [plateNumber, setPlateNumber] = useState("");
  const [doors, setDoors] = useState(numText(prefill?.doors));
  const [engineCc, setEngineCc] = useState(numText(prefill?.engine_cc));
  const [odometerKm, setOdometerKm] = useState("");

  // ── Rental terms (under More details) - SL defaults pre-filled ──
  const [weeklyRate, setWeeklyRate] = useState(numText(prefill?.weekly_rate_lkr));
  const [includedKmPerDay, setIncludedKmPerDay] = useState(prefill ? numText(prefill.included_km_per_day) : "100");
  const [unlimitedKm, setUnlimitedKm] = useState(prefill?.unlimited_km ?? false);
  const [extraMileage, setExtraMileage] = useState(numText(prefill?.extra_mileage_lkr));
  const [deliveryAvailable, setDeliveryAvailable] = useState(prefill?.delivery_available ?? false);
  const [deliveryFee, setDeliveryFee] = useState(numText(prefill?.delivery_fee_lkr));
  const [minRentalDays, setMinRentalDays] = useState(prefill ? numText(prefill.min_rental_days) || "1" : "1");
  const [maxRentalDays, setMaxRentalDays] = useState(numText(prefill?.max_rental_days));

  // Both default to nothing. They used to start at Rs 5,000 and Rs 1,000, and
  // a blank field still saved those amounts, so an owner who never chose to
  // charge a cleaning or refuel fee ended up advertising one.
  const [cleaningFee, setCleaningFee] = useState(prefill ? numText(prefill.cleaning_fee_lkr) : "");
  const [refuelFee, setRefuelFee] = useState(prefill ? numText(prefill.refuel_fee_lkr) : "");
  const [lateFeePerHour, setLateFeePerHour] = useState(numText(prefill?.late_fee_per_hour_lkr));

  const [smokingAllowed, setSmokingAllowed] = useState(prefill?.smoking_allowed ?? false);
  const [petsAllowed, setPetsAllowed] = useState(prefill?.pets_allowed ?? false);
  const [rideHailAllowed, setRideHailAllowed] = useState(prefill?.ride_hail_allowed ?? false);
  const [restrictedUse, setRestrictedUse] = useState<string[]>(prefill?.restricted_use ?? []);

  const [minRenterAge, setMinRenterAge] = useState(prefill ? numText(prefill.min_renter_age) || "23" : "23");
  const [minLicenseYears, setMinLicenseYears] = useState(prefill ? numText(prefill.min_license_years) || "2" : "2");

  const [hasGpsTracker, setHasGpsTracker] = useState(prefill?.has_gps_tracker ?? false);
  const [hasEtcTag, setHasEtcTag] = useState(prefill?.has_etc_tag ?? false);

  const [perKmRate, setPerKmRate] = useState(numText(prefill?.per_km_rate_lkr));
  const [tollsIncluded, setTollsIncluded] = useState<boolean | null>(prefill?.tolls_included ?? null);
  const [driverBata, setDriverBata] = useState(numText(prefill?.driver_bata_lkr));

  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [crFile, setCrFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [revenueLicenseFile, setRevenueLicenseFile] = useState<File | null>(null);

  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  // Gates the autosave below. On the first commit both effects run in order,
  // so an autosave that fired before the restore landed would write the empty
  // starting state straight over the saved draft. This is state rather than a
  // ref on purpose: it is set in the same batch as the restored values, so the
  // render that first enables saving is also the one that holds real data.
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [authorityBasis, setAuthorityBasis] = useState<"registered_owner" | "authorized_operator" | null>(null);
  const [authorityDeclared, setAuthorityDeclared] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Errors render below the fields, so on a long step the message could land
  // far below the fold. Bring it into view instead of leaving the button
  // looking like it did nothing.
  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  // Which specs apply to this vehicle. Doors are meaningless on a bike or
  // tuk-tuk, and an electric vehicle has no engine cc.
  const needsDoors = vehicleType === "car" || vehicleType === "suv" || vehicleType === "van";
  const isElectric = fuelType === "electric";
  const showBodyType = hasBodyType(vehicleType);
  const bodyTypeOptions = bodyTypesFor(vehicleType, bodyType).map((v) => ({ value: v, label: v }));
  const specColumns = (needsDoors ? 1 : 0) + (isElectric ? 0 : 1);
  const specGridClass = specColumns === 2 ? "grid-cols-2" : "grid-cols-1";

  // Switching the vehicle type used to leave the old body style selected, so
  // picking SUV, choosing "SUV", then switching to Car left Car showing "SUV".
  // bodyTypesFor keeps an unknown value in the list on purpose, so that editing
  // an old listing never blanks a saved answer. That is the wrong behaviour for
  // a deliberate switch, so this asks for the plain list instead.
  function changeVehicleType(next: VehicleType) {
    setVehicleType(next);
    setBodyType((current) => {
      if (!current) return current;
      const allowed = bodyTypesFor(next);
      // Bikes and tuk-tuks hide the question rather than answering it, so
      // tapping through one and back keeps whatever was already chosen.
      if (allowed.length === 0) return current;
      return allowed.includes(current) ? current : "";
    });
  }

  // ── Autosave text fields ──
  useEffect(() => {
    // Duplicating seeds every field from the source listing, so there is no
    // draft to load and nothing of the owner's to overwrite.
    if (prefill) { setDraftHydrated(true); return; }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        setMake(d.make ?? ""); setModel(d.model ?? ""); setYear(d.year ?? CURRENT_YEAR - 3);
        setVehicleType(d.vehicleType ?? "car"); setDailyRate(d.dailyRate ?? ""); setDeposit(d.deposit ?? "");
        setSelfDrive(d.selfDrive ?? true); setWithDriver(d.withDriver ?? false); setAirportPickup(d.airportPickup ?? false);
        setTransmission(d.transmission ?? "automatic"); setSeats(d.seats ?? 5); setFuelType(d.fuelType ?? "");
        setCity(d.city ?? agencyCity); setInsuranceType(d.insuranceType ?? "");
        // Older drafts stored rules as newline text; migrate them to the chip list.
        setRules(Array.isArray(d.rules) ? d.rules : (d.rulesText ? String(d.rulesText).split("\n").map((s: string) => s.trim()).filter(Boolean) : []));
        setFeatures(Array.isArray(d.features) ? d.features : []);
        setDescription(d.description ?? "");
        setBodyType(d.bodyType ?? ""); setVariant(d.variant ?? ""); setPlateNumber(d.plateNumber ?? ""); setDoors(d.doors ?? "");
        setEngineCc(d.engineCc ?? ""); setOdometerKm(d.odometerKm ?? "");
        setWeeklyRate(d.weeklyRate ?? ""); setIncludedKmPerDay(d.includedKmPerDay ?? "100"); setUnlimitedKm(d.unlimitedKm ?? false);
        setExtraMileage(d.extraMileage ?? ""); setDeliveryAvailable(d.deliveryAvailable ?? false); setDeliveryFee(d.deliveryFee ?? "");
        setMinRentalDays(d.minRentalDays ?? "1"); setMaxRentalDays(d.maxRentalDays ?? "");
        setCleaningFee(d.cleaningFee ?? ""); setRefuelFee(d.refuelFee ?? ""); setLateFeePerHour(d.lateFeePerHour ?? "");
        setSmokingAllowed(d.smokingAllowed ?? false); setPetsAllowed(d.petsAllowed ?? false);
        setRideHailAllowed(d.rideHailAllowed ?? false);
        setRestrictedUse(Array.isArray(d.restrictedUse) ? d.restrictedUse : []);
        setMinRenterAge(d.minRenterAge ?? "23"); setMinLicenseYears(d.minLicenseYears ?? "2");
        setHasGpsTracker(d.hasGpsTracker ?? false); setHasEtcTag(d.hasEtcTag ?? false);
        setPerKmRate(d.perKmRate ?? ""); setTollsIncluded(d.tollsIncluded ?? null); setDriverBata(d.driverBata ?? "");
        // Photos are File objects and cannot go into localStorage, so a
        // restored draft always comes back without them. Landing on the photo
        // step puts the owner where the missing work actually is, instead of a
        // later step that would refuse to move on. Drafts saved by the old
        // six-step wizard clamp the same way.
        const savedStep = typeof d.step === "number" ? d.step : 0;
        setStep(Math.max(0, Math.min(savedStep, PHOTOS_STEP)));
        setDraftRestored(true);
      }
    } catch { /* ignore */ } finally {
      setDraftHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Object URLs for the photo previews are revoked when a photo is removed;
  // this catches the rest when the wizard unmounts (submitted or navigated
  // away) so a long session does not hold every picked file in memory.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => {
    photosRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  function discardDraft() {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    window.location.reload();
  }

  useEffect(() => {
    if (!draftHydrated || prefill) return;
    const d = {
      step,
      make, model, year, vehicleType, dailyRate, deposit, selfDrive, withDriver, airportPickup, transmission, seats, fuelType, city, insuranceType, rules, features, description,
      bodyType, variant, plateNumber, doors, engineCc, odometerKm,
      weeklyRate, includedKmPerDay, unlimitedKm, extraMileage, deliveryAvailable, deliveryFee, minRentalDays, maxRentalDays,
      cleaningFee, refuelFee, lateFeePerHour,
      smokingAllowed, petsAllowed, rideHailAllowed, restrictedUse,
      minRenterAge, minLicenseYears, hasGpsTracker, hasEtcTag,
      perKmRate, tollsIncluded, driverBata,
    };
    try { localStorage.setItem(draftKey, JSON.stringify(d)); } catch { /* ignore */ }
  }, [draftHydrated, prefill, draftKey, step,
      make, model, year, vehicleType, dailyRate, deposit, selfDrive, withDriver, airportPickup, transmission, seats, fuelType, city, insuranceType, rules, features, description,
      bodyType, variant, plateNumber, doors, engineCc, odometerKm,
      weeklyRate, includedKmPerDay, unlimitedKm, extraMileage, deliveryAvailable, deliveryFee, minRentalDays, maxRentalDays,
      cleaningFee, refuelFee, lateFeePerHour,
      smokingAllowed, petsAllowed, rideHailAllowed, restrictedUse,
      minRenterAge, minLicenseYears, hasGpsTracker, hasEtcTag,
      perKmRate, tollsIncluded, driverBata]);

  /** An error, and whether it lives inside the folded "More details" section. */
  function stepProblem(s: number): { message: string; inMore?: boolean } | null {
    if (s === 0) {
      if (!make.trim() || !model.trim()) return { message: "Add the make and model." };
      if (!year || String(year).length !== 4) return { message: "Add a 4-digit year." };
      if (!plateNumber.trim()) return { message: "Add the registration plate number. It stays private until a booking is confirmed." };
      if (!fuelType) return { message: "Select the fuel type." };
      if (needsDoors && !doors) return { message: "Add the number of doors." };
      if (!isElectric && !engineCc) return { message: "Add the engine size (cc)." };
      if (!seats || Number(seats) < 1) return { message: "Add the number of seats." };
    }
    // Decision 10: a listing needs the core photo set before it can be
    // submitted for review - no more photo-less listings.
    if (s === 1 && photos.length < MIN_LISTING_PHOTOS) {
      return { message: `Add at least ${MIN_LISTING_PHOTOS} clear photos (front, back, sides, interior).` };
    }
    if (s === 2) {
      if (!dailyRate || Number(dailyRate) < 500) return { message: "Add a daily price (min Rs. 500)." };
      if (!selfDrive && !withDriver) return { message: "Choose self-drive, with driver, or both." };
      if (!insuranceType) return { message: "Choose the insurance this vehicle has." };
      // These used to be clamped silently on save, so an owner who typed
      // 25,000 for cleaning got 10,000 and was never told.
      if (cleaningFee && Number(cleaningFee) > MAX_CLEANING_FEE) {
        return { message: `The cleaning fee cannot be more than Rs. ${MAX_CLEANING_FEE.toLocaleString("en-LK")}.`, inMore: true };
      }
      if (minRenterAge && (Number(minRenterAge) < MIN_RENTER_AGE_FLOOR || Number(minRenterAge) > MIN_RENTER_AGE_CEILING)) {
        return { message: `Minimum renter age must be between ${MIN_RENTER_AGE_FLOOR} and ${MIN_RENTER_AGE_CEILING}.`, inMore: true };
      }
      if (minRentalDays && maxRentalDays && Number(maxRentalDays) < Number(minRentalDays)) {
        return { message: "The maximum rental length cannot be shorter than the minimum.", inMore: true };
      }
      if (canDeclareListingAuthority && (!authorityBasis || !authorityDeclared)) {
        return { message: "Confirm that you own this vehicle or are authorised to operate and rent it." };
      }
    }
    return null;
  }

  // Moving between steps swaps the whole screen but left the scroll position
  // where it was, so pressing Next at the bottom of a long step landed you at
  // the bottom of the next one, often past all of its content.
  function goToStep(nextStep: number) {
    setStep(nextStep);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    const problem = stepProblem(step);
    if (problem) { showError(problem.message); return; }
    setError(null);
    goToStep(Math.min(LAST_STEP, step + 1));
  }
  function back() { setError(null); goToStep(Math.max(0, step - 1)); }

  async function submit() {
    // The last step has no Next button, so its own check (including the
    // right-to-list declaration) would never run. Re-check every step here.
    for (let s = 0; s <= LAST_STEP; s += 1) {
      const problem = stepProblem(s);
      if (problem) {
        if (problem.inMore) setShowMore(true);
        showError(problem.message);
        if (s !== step) goToStep(s);
        return;
      }
    }
    if (containsPublicContactDetails(description, ...rules)) {
      setShowMore(true);
      showError(PUBLIC_CONTACT_ERROR);
      return;
    }
    setLoading(true); setError(null);
    const uploadOptions = adminDraft ? { agencyId } : {};
    try {
      // Upload every photo; a failed upload must NOT be silently dropped -
      // stop and let the owner retry (decision 10 / audit TRUST-020).
      const photoUrls: string[] = [];
      setUploadProgress({ done: 0, total: photos.length });
      for (const { file } of photos) {
        try {
          photoUrls.push((await uploadToR2("vehicle-photos", file, uploadOptions)).publicUrl);
          setUploadProgress({ done: photoUrls.length, total: photos.length });
        } catch (err) {
          // Keep the real reason. This used to be replaced with "check your
          // connection", which sent people to their wifi settings when the
          // actual problem was an unsupported file or one over the size limit.
          const reason = err instanceof Error ? err.message : "The upload failed.";
          showError(`${file.name}: ${reason}`);
          setUploadProgress(null);
          setLoading(false);
          return;
        }
      }
      setUploadProgress(null);
      if (photoUrls.length < MIN_LISTING_PHOTOS) {
        showError(`Please add at least ${MIN_LISTING_PHOTOS} clear photos before submitting.`);
        setLoading(false);
        return;
      }
      let crUrl: string | null = null, insUrl: string | null = null, revenueLicenseUrl: string | null = null;
      if (crFile) crUrl = (await uploadToR2("vehicle-docs", crFile, uploadOptions)).publicUrl;
      if (insuranceFile) insUrl = (await uploadToR2("vehicle-docs", insuranceFile, uploadOptions)).publicUrl;
      if (revenueLicenseFile) revenueLicenseUrl = (await uploadToR2("vehicle-docs", revenueLicenseFile, uploadOptions)).publicUrl;

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
          agency_id: agencyId, slug, status: canDeclareListingAuthority ? "pending_review" : "unlisted",
          make: make.trim(), model: model.trim(), year: Number(year),
          vehicle_type: vehicleType, daily_rate_lkr: Number(dailyRate), deposit_lkr: Number(deposit) || 0,
          self_drive: selfDrive, with_driver: withDriver, airport_pickup: airportPickup,
          transmission, seats: Number(seats), fuel_type: fuelType || null, city,
          insurance_type: insuranceType as "hire" | "private", mileage_limit: mileageLimitDerived,
          rules: cleanRules, features: cleanFeatures.length ? cleanFeatures : null,
          description: description.trim() || null,
          photos: photoUrls.length ? photoUrls : null,
          // ── Vehicle identity (optional) ──
          body_type: showBodyType ? (bodyType || null) : null,
          variant: variant.trim() || null,
          plate_number: plateNumber.trim().toUpperCase(),
          doors: needsDoors && doors ? Number(doors) : null,
          engine_cc: !isElectric && engineCc ? Number(engineCc) : null,
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
          cleaning_fee_lkr: cleaningFee ? Number(cleaningFee) : 0,
          refuel_fee_lkr: refuelFee ? Number(refuelFee) : 0,
          late_fee_per_hour_lkr: lateFeePerHour ? Number(lateFeePerHour) : null,
          // ── House rules ──
          smoking_allowed: smokingAllowed,
          pets_allowed: petsAllowed,
          ride_hail_allowed: rideHailAllowed,
          second_driver_allowed: false,
          restricted_use: restrictedUse,
          // ── Renter requirements ──
          min_renter_age: minRenterAge ? Number(minRenterAge) : 23,
          min_license_years: minLicenseYears ? Number(minLicenseYears) : 2,
          // ── Disclosures ──
          has_gps_tracker: hasGpsTracker,
          has_etc_tag: hasEtcTag,
          // ── With-driver terms ──
          per_km_rate_lkr: withDriver && perKmRate ? Number(perKmRate) : null,
          tolls_included: withDriver ? tollsIncluded : null,
          driver_bata_lkr: withDriver && driverBata ? Number(driverBata) : null,
          listing_authority_basis: canDeclareListingAuthority ? authorityBasis : null,
          listing_authority_declared: canDeclareListingAuthority ? authorityDeclared : false,
        })
        .select("id, status").single();

      if (insErr) throw new Error(insErr.message);
      const saved = inserted as { id: string; status: string };

      let documentSaveFailed = false;
      if (crUrl || insUrl || revenueLicenseUrl) {
        const { error: documentError } = await supabase.from("vehicle_documents").upsert({
          vehicle_id: saved.id,
          cr_url: crUrl,
          insurance_url: insUrl,
          revenue_license_url: revenueLicenseUrl,
        }, { onConflict: "vehicle_id" });
        if (documentError) {
          console.error("[vehicle documents]", documentError.message);
          documentSaveFailed = true;
        }
      }

      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }

      if (adminDraft) {
        // Tell the owner there is a draft waiting for them. The draft itself is
        // already saved, so a failed message only costs the nudge.
        await fetch(`/api/admin/vehicles/${saved.id}/drafted`, { method: "POST" }).catch(() => undefined);
        startNavigationProgress();
        router.push(`/admin/agencies?drafted=${encodeURIComponent(`${year} ${make.trim()} ${model.trim()}`)}`);
        router.refresh();
        return;
      }

      const destination = documentSaveFailed
        ? "/dashboard/vehicles?documents=retry"
        : canDeclareListingAuthority
          ? `/dashboard/vehicles?submitted=${saved.status === "available" ? "live" : "review"}`
          : "/dashboard/vehicles?authority=owner-review";
      startNavigationProgress();
      router.push(destination);
      router.refresh();
    } catch (err) {
      setUploadProgress(null);
      showError(err instanceof Error ? err.message : "Could not save this vehicle. Your progress is saved on this device, check your connection and try again.");
      setLoading(false);
    }
  }

  // Not a <form> (a stray Enter must never submit a multi-step flow), so Enter
  // is wired explicitly: it advances from a single-line field, and does
  // nothing in a textarea, where a newline is what people mean.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || loading) return;
    const el = e.target as HTMLElement;
    if (el.tagName === "TEXTAREA" || el.tagName === "BUTTON") return;
    if (el.tagName !== "INPUT") return;
    e.preventDefault();
    if (step < LAST_STEP) next();
  }

  const submitLabel = adminDraft
    ? "Save draft for the owner"
    : canDeclareListingAuthority ? "Submit listing" : "Save for owner review";

  return (
    <div className="max-w-xl" onKeyDown={onKeyDown}>
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

      {/* A saved draft used to reappear with no explanation, which reads as the
          form remembering the wrong vehicle. Say so, and offer a clean start.
          Photos are files and cannot be saved, so that is stated too. */}
      {draftRestored && step <= PHOTOS_STEP && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-3.5">
          <p className="text-sm font-semibold text-blue-900">We brought back your unfinished listing.</p>
          <p className="mt-1 text-xs leading-5 text-blue-900/90">
            Everything you typed is here. Photos cannot be saved on this device, so those need adding again.
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="mt-2 min-h-11 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            Start a fresh listing instead
          </button>
        </div>
      )}

      {/* ── Step 1: Your vehicle ── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="text-slate-600 text-sm mb-2">What kind of vehicle is it?</p>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_TILES.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => changeVehicleType(value)}
                  className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 font-semibold text-sm transition-all ${vehicleType === value ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  <Icon size={22} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BigField label="Make">
              <input className={bigInput} value={make} onChange={(e) => setMake(e.target.value)} placeholder={makeModelHint(vehicleType).make} list="sl-makes" />
              <datalist id="sl-makes">
                {SL_MAKES.map((m) => <option key={m} value={m} />)}
              </datalist>
            </BigField>
            <BigField label="Model"><input className={bigInput} value={model} onChange={(e) => setModel(e.target.value)} placeholder={makeModelHint(vehicleType).model} /></BigField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BigField label="Year"><input className={bigInput} type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))} placeholder="2018" /></BigField>
            <BigField label="Seats"><input className={bigInput} type="number" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value === "" ? "" : Number(e.target.value))} min={1} max={20} /></BigField>
          </div>
          <BigField label="Registration plate number">
            <input className={bigInput} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="WP CAB-1234" autoCapitalize="characters" />
            <p className="mt-1 text-xs leading-5 text-slate-500">Kept private while browsing. The confirmed renter sees it for the handover plate check.</p>
          </BigField>
          <div>
            <p className="text-slate-600 text-sm mb-2">Fuel</p>
            <div className="grid grid-cols-4 gap-2">
              {FUEL_TILES.map((f) => (
                <button key={f} type="button" onClick={() => setFuelType(f)}
                  className={`min-h-11 rounded-xl border-2 font-semibold text-sm capitalize ${fuelType === f ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{f}</button>
              ))}
            </div>
          </div>
          {/* Required: renters filter and compare on these. Doors are skipped
              for bikes and tuk-tuks, engine size for electric vehicles. */}
          {specColumns > 0 && (
            <div className={`grid gap-3 ${specGridClass}`}>
              {needsDoors && <BigField label="Doors"><input className={bigInput} type="number" inputMode="numeric" value={doors} onChange={(e) => setDoors(e.target.value)} min={1} max={6} placeholder="4" /></BigField>}
              {!isElectric && <BigField label="Engine cc"><input className={bigInput} type="number" inputMode="numeric" value={engineCc} onChange={(e) => setEngineCc(e.target.value)} min={0} placeholder="1500" /></BigField>}
            </div>
          )}
          {/* Tiptronic is its own answer here, not a kind of automatic: plenty
              of the used Japanese imports rented in Sri Lanka have it, and a
              renter who needs a true automatic wants to know the difference. */}
          <div>
            <p className="text-slate-600 text-sm mb-2">Transmission</p>
            <div className="grid grid-cols-3 gap-2">
              {["automatic", "manual", "tiptronic"].map((t) => (
                <button key={t} type="button" onClick={() => setTransmission(t)}
                  className={`min-h-11 rounded-xl border-2 px-1 font-semibold text-sm capitalize ${transmission === t ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Photos ── */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-slate-600 text-sm">Add a few clear photos, then put them in the order renters should see them.</p>
          <input id="wizard-photo-input" type="file" accept={PHOTO_ACCEPT} multiple className="sr-only"
            onChange={(e) => { if (e.target.files) { const items = Array.from(e.target.files).map((file) => ({ file, url: URL.createObjectURL(file) })); setPhotos((p) => [...p, ...items]); } e.target.value = ""; }} />
          <label htmlFor="wizard-photo-input"
            className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-colors">
            <Camera size={36} className="mx-auto mb-2 text-blue-600" strokeWidth={1.5} />
            <p className="text-slate-700 font-semibold">Tap to add photos</p>
            <p className="text-slate-500 text-xs mt-0.5">Add at least 4 clear photos: front, back, sides and interior. JPG or PNG.</p>
          </label>
          <PhotoOrderGrid
            photos={photos.map((item) => ({ key: item.url, src: item.url, pending: true }))}
            onMove={(from, to) => setPhotos((prev) => movePhotoInList(prev, from, to))}
            onRemove={(i) => setPhotos((prev) => {
              const target = prev[i];
              if (target) URL.revokeObjectURL(target.url);
              return prev.filter((_, j) => j !== i);
            })}
          />
        </div>
      )}

      {/* ── Step 3: Price and go live ── */}
      {step === 2 && (
        <div className="space-y-5">
          <BigField label="Price per day (LKR)">
            <input className={`${bigInput} text-2xl font-bold`} type="number" inputMode="numeric" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="6500" min={500} />
          </BigField>

          <div>
            <p className="text-slate-600 text-sm mb-2">How can people rent it? (tap all that apply)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Self-drive", on: selfDrive, set: setSelfDrive },
                { label: "With driver", on: withDriver, set: setWithDriver },
              ].map(({ label, on, set }) => (
                <button key={label} type="button" onClick={() => set(!on)}
                  className={`py-4 rounded-2xl border-2 font-semibold text-sm transition-all ${on ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {on && <Check size={14} className="inline mr-1" />}{label}
                </button>
              ))}
            </div>
          </div>

          <BigField label="City"><Select value={city} onChange={setCity} options={CITY_OPTIONS} label="City" /></BigField>

          <div>
            <p className="text-slate-600 text-sm mb-2">Insurance</p>
            <div className="grid grid-cols-2 gap-2">
              {([["hire", "Hire (commercial)"], ["private", "Private (P-number)"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setInsuranceType(v)}
                  className={`min-h-11 rounded-xl border-2 font-semibold text-sm ${insuranceType === v ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Everything below already has a sensible default, so it is folded
              away rather than asked. Owners can fill it in now or from Edit. */}
          <div className="rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">More details (optional)</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Deposit, km allowance, fees, house rules, features and documents. Defaults are set, change them now or later.
                </span>
              </span>
              <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${showMore ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {showMore && (
              <div className="space-y-6 border-t border-slate-200 px-4 py-5">
                {/* Vehicle specs */}
                <div className="space-y-3">
                  <SectionHeading>Vehicle specs</SectionHeading>
                  {/* A bike and a tuk-tuk have no body style, so the question is
                      not asked at all rather than offering them "Sedan". */}
                  <div className={`grid gap-3 ${showBodyType ? "grid-cols-2" : "grid-cols-1"}`}>
                    {showBodyType && (
                      <BigField label="Body type">
                        <Select value={bodyType} onChange={setBodyType} options={bodyTypeOptions} placeholder="Select…" label="Body type" />
                      </BigField>
                    )}
                    <BigField label="Variant"><input className={bigInput} value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="GLi, Hybrid, etc." /></BigField>
                  </div>
                  <BigField label="Odometer km"><input className={bigInput} type="number" inputMode="numeric" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} min={0} placeholder="65000" /></BigField>
                  <ToggleField label="Airport handover available" hint="Handed over or collected at the airport. This does not change who drives it." on={airportPickup} onChange={setAirportPickup} />
                </div>

                {/* Pricing extras */}
                <div className="space-y-3">
                  <SectionHeading>Pricing extras</SectionHeading>
                  <BigField label="Weekly rate"><input className={bigInput} type="number" inputMode="numeric" value={weeklyRate} onChange={(e) => setWeeklyRate(e.target.value)} placeholder="e.g. 40000" min={0} /></BigField>
                  {/* The switch comes before the fields it disables. It used to sit
                      underneath them, so the allowance greyed itself out for no
                      visible reason. */}
                  <ToggleField label="Unlimited km" hint="Turn on to remove the daily distance allowance" on={unlimitedKm} onChange={setUnlimitedKm} />
                  {!unlimitedKm && (
                    <div className="grid grid-cols-2 gap-3">
                      <BigField label="Included km/day" hint="Extra km beyond this is charged">
                        <input className={bigInput} type="number" inputMode="numeric" value={includedKmPerDay} onChange={(e) => setIncludedKmPerDay(e.target.value)} placeholder="100" min={0} />
                      </BigField>
                      <BigField label="Extra km charge (LKR/km)"><input className={bigInput} type="number" inputMode="numeric" value={extraMileage} onChange={(e) => setExtraMileage(e.target.value)} placeholder="e.g. 30" min={0} /></BigField>
                    </div>
                  )}
                  <ToggleField label="Delivery available" hint="Deliver the vehicle to the renter for a fee" on={deliveryAvailable} onChange={setDeliveryAvailable} />
                  {deliveryAvailable && (
                    <BigField label="Delivery fee (LKR)"><input className={bigInput} type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="e.g. 1500" min={0} /></BigField>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <BigField label="Min rental days"><input className={bigInput} type="number" value={minRentalDays} onChange={(e) => setMinRentalDays(e.target.value)} min={1} /></BigField>
                    <BigField label="Max rental days"><input className={bigInput} type="number" value={maxRentalDays} onChange={(e) => setMaxRentalDays(e.target.value)} min={1} placeholder="No limit" /></BigField>
                  </div>
                </div>

                {/* Deposit & fees */}
                <div className="space-y-3">
                  <SectionHeading>Deposit &amp; fees</SectionHeading>
                  <BigField label="Refundable deposit (LKR)" hint="Held by you, returned after the rental. Leave blank for none.">
                    <input className={bigInput} type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" min={0} step={1000} />
                  </BigField>
                  <div className="grid grid-cols-2 gap-3">
                    <BigField label="Cleaning fee" hint="Only if it comes back excessively dirty. Blank means no fee, and Rs. 10,000 is the most you can charge.">
                      <input className={bigInput} type="number" value={cleaningFee} onChange={(e) => setCleaningFee(e.target.value)} placeholder="0" min={0} max={10000} step={500} />
                    </BigField>
                    <BigField label="Refuel service fee" hint="Only if it comes back with less fuel. Blank means no fee.">
                      <input className={bigInput} type="number" value={refuelFee} onChange={(e) => setRefuelFee(e.target.value)} placeholder="0" min={0} step={100} />
                    </BigField>
                  </div>
                  <BigField label="Late fee per hour"><input className={bigInput} type="number" value={lateFeePerHour} onChange={(e) => setLateFeePerHour(e.target.value)} min={0} placeholder="No fee when blank" /></BigField>
                </div>

                {/* Renter requirements */}
                <div className="space-y-3">
                  <SectionHeading>Renter requirements</SectionHeading>
                  <div className="grid grid-cols-2 gap-3">
                    <BigField label="Min age"><input className={bigInput} type="number" value={minRenterAge} onChange={(e) => setMinRenterAge(e.target.value)} min={18} max={40} /></BigField>
                    <BigField label="Min years holding licence (you check at handover)"><input className={bigInput} type="number" value={minLicenseYears} onChange={(e) => setMinLicenseYears(e.target.value)} min={0} /></BigField>
                  </div>
                </div>

                {/* With-driver terms */}
                {withDriver && (
                  <div className="space-y-3">
                    <SectionHeading>With-driver terms</SectionHeading>
                    <div className="grid grid-cols-2 gap-3">
                      <BigField label="Per-km rate"><input className={bigInput} type="number" value={perKmRate} onChange={(e) => setPerKmRate(e.target.value)} min={0} placeholder="e.g. 60" /></BigField>
                      <BigField label="Driver overnight allowance (Rs/night)"><input className={bigInput} type="number" value={driverBata} onChange={(e) => setDriverBata(e.target.value)} min={0} placeholder="2000" /></BigField>
                    </div>
                    <div>
                      <p className="text-slate-600 text-sm mb-2">Tolls included in price?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => (
                          <button key={l} type="button" onClick={() => setTollsIncluded(v)}
                            className={`min-h-11 rounded-xl border-2 font-semibold text-sm ${tollsIncluded === v ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* House rules */}
                <div className="space-y-2">
                  <SectionHeading>House rules</SectionHeading>
                  <ToggleField label="Smoking allowed" on={smokingAllowed} onChange={setSmokingAllowed} />
                  <ToggleField label="Pets allowed" on={petsAllowed} onChange={setPetsAllowed} />
                  <ToggleField label="Ride-hail / commercial use allowed" on={rideHailAllowed} onChange={setRideHailAllowed} />
                  {selfDrive && (
                    <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                      Self-drive is limited to the verified account holder named on the booking. Additional renter-drivers are not supported at launch.
                    </p>
                  )}
                  <div className="pt-1">
                    <p className="text-slate-600 text-sm mb-2">Not allowed:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {RESTRICTED_USE_OPTIONS.map(({ value, label }) => {
                        const on = restrictedUse.includes(value);
                        return (
                          <button key={value} type="button"
                            onClick={() => setRestrictedUse((r) => on ? r.filter((v) => v !== value) : [...r, value])}
                            className={`inline-flex min-h-11 items-center gap-1.5 px-3.5 rounded-full border text-sm font-medium transition-all ${on ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                            {on && <Check size={12} />} {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Disclosures */}
                <div className="space-y-2">
                  <SectionHeading>Disclosures</SectionHeading>
                  <ToggleField label="GPS tracker fitted" hint="Shown on your listing, so renters know before they request" on={hasGpsTracker} onChange={setHasGpsTracker} />
                  <ToggleField label="ETC expressway tag fitted" hint="Tag charges during a rental are billed to the renter" on={hasEtcTag} onChange={setHasEtcTag} />
                </div>

                <div>
                  <p className="text-slate-600 text-sm mb-0.5">Features</p>
                  <p className="text-slate-400 text-xs mb-2">Tap everything this vehicle has.</p>
                  <PresetPicker presets={FEATURE_PRESETS} value={features} onChange={setFeatures} addPlaceholder="Add another feature" />
                </div>
                <div>
                  <p className="text-slate-600 text-sm mb-0.5">Handover rules</p>
                  <p className="text-slate-400 text-xs mb-2">Tap the rules that apply, renters see these on the listing.</p>
                  <PresetPicker presets={RULE_PRESETS} value={rules} onChange={setRules} addPlaceholder="Add your own rule" />
                </div>
                <div>
                  <p className="text-slate-600 text-sm mb-0.5">Documents</p>
                  <p className="text-slate-400 text-xs mb-2">
                    Add all three when you are ready to apply for the Verified Vehicle badge.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <DocPick label="Registration (CR)" file={crFile} onPick={setCrFile} />
                    <DocPick label="Insurance" file={insuranceFile} onPick={setInsuranceFile} />
                    <DocPick label="Revenue licence" file={revenueLicenseFile} onPick={setRevenueLicenseFile} />
                  </div>
                  <p className="text-slate-400 text-xs mt-1.5">Documents are private, only DriveLink admins see them.</p>
                </div>
              </div>
            )}
          </div>

          {canDeclareListingAuthority ? (
            <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">Your right to list this vehicle</legend>
              <p className="text-xs leading-5 text-slate-600">Choose the true statement. DriveLink may ask for supporting proof.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["registered_owner", "Owned by this page's operator"],
                  ["authorized_operator", "Listed with the registered owner's authority"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setAuthorityBasis(value)}
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold ${authorityBasis === value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-700">
                <input type="checkbox" checked={authorityDeclared} onChange={(e) => setAuthorityDeclared(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                <span>I confirm this Rental Page has the legal right to offer this vehicle for the rental modes shown, and the details are accurate.</span>
              </label>
            </fieldset>
          ) : adminDraft ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              This is saved as a private draft on {adminDraft.pageName}. The owner gets a message, checks the details,
              confirms their right to list it and submits it. Nothing is shown to renters until then.
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              This will be saved privately for a Rental Page owner or manager to review. Only they can confirm the page&apos;s right to list the vehicle and send it to DriveLink.
            </div>
          )}
          {canDeclareListingAuthority && (
            <p className="text-slate-500 text-xs">
              New listings are usually checked within 24 hours, and we text you the moment yours is live. Once one listing is
              approved, your next ones go live as soon as you submit them.
            </p>
          )}
        </div>
      )}

      {error && (
        <p ref={errorRef} role="alert" className="text-rose-600 text-sm font-medium mt-4">{error}</p>
      )}

      {uploadProgress && (
        <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">
            Uploading photo {Math.min(uploadProgress.done + 1, uploadProgress.total)} of {uploadProgress.total}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${uploadProgress.total ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-blue-900/80">Keep this screen open until it finishes.</p>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 mt-7">
        <button type="button" onClick={back} disabled={step === 0 || loading}
          className="inline-flex min-h-11 items-center gap-1.5 px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        {step < LAST_STEP ? (
          <button type="button" onClick={next}
            className="inline-flex min-h-11 items-center gap-1.5 px-6 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={loading}
            className="inline-flex min-h-11 items-center gap-1.5 px-6 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 transition-colors">
            {loading ? "Saving…" : submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}

const bigInput = "w-full min-h-11 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white";

function BigField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-slate-700 text-sm font-medium mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-slate-400 text-xs mt-1 block">{hint}</span>}
    </label>
  );
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
      <p className="text-slate-400 text-xs mt-1.5 inline-flex items-center gap-1"><FileText size={10} /> JPG/PNG/PDF</p>
    </div>
  );
}
