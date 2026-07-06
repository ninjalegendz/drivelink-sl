import {
  IdCard, Fuel, CigaretteOff, PawPrint, Gauge, Mountain, Banknote, Wallet,
  Camera, Map as MapIcon, UserCheck, Clock, Check,
  Snowflake, Bluetooth, Usb, Navigation, Smartphone, Video, Sun, Baby,
  Radar, Armchair, type LucideIcon,
} from "lucide-react";

// ─── Preset handover rules ───────────────────────────────────
// Platform-curated set so providers tap instead of typing. Stored in the DB
// as the plain label text (vehicles.rules text[]), so old free-typed rules
// and custom additions keep working. Each preset carries its own icon; the
// public listing matches saved text back to an icon via ruleIcon().

export interface PresetItem {
  label: string;
  Icon:  LucideIcon;
}

export const RULE_PRESETS: PresetItem[] = [
  { label: "Valid licence or IDP required for self-drive", Icon: IdCard },
  { label: "Return with the same fuel level",              Icon: Fuel },
  { label: "No smoking inside the vehicle",                Icon: CigaretteOff },
  { label: "No pets inside the vehicle",                   Icon: PawPrint },
  { label: "Daily mileage cap applies, extra km charged",  Icon: Gauge },
  { label: "No off-road or beach driving",                 Icon: Mountain },
  { label: "Refundable deposit collected at handover",     Icon: Banknote },
  { label: "Renter pays fuel, parking and fines",          Icon: Wallet },
  { label: "Condition photos taken at handover and return", Icon: Camera },
  { label: "Island-wide travel allowed",                   Icon: MapIcon },
  { label: "Minimum age 21 for self-drive",                Icon: UserCheck },
  { label: "Late return charged per extra hour",           Icon: Clock },
];

// ─── Preset features ─────────────────────────────────────────

export const FEATURE_PRESETS: PresetItem[] = [
  { label: "AC",                    Icon: Snowflake },
  { label: "Bluetooth audio",       Icon: Bluetooth },
  { label: "Reverse camera",        Icon: Camera },
  { label: "USB charging",          Icon: Usb },
  { label: "GPS navigation",        Icon: Navigation },
  { label: "Android Auto / CarPlay", Icon: Smartphone },
  { label: "Dashcam",               Icon: Video },
  { label: "Parking sensors",       Icon: Radar },
  { label: "Sunroof",               Icon: Sun },
  { label: "Leather seats",         Icon: Armchair },
  { label: "Child seat available",  Icon: Baby },
];

// ─── Icon lookup for saved text ──────────────────────────────
// Normalised (lowercase, trimmed) label → icon. Custom/legacy rules that
// don't match any preset fall back to a plain check mark.

const iconMap = new Map<string, LucideIcon>(
  [...RULE_PRESETS, ...FEATURE_PRESETS].map((p) => [p.label.toLowerCase(), p.Icon])
);

export function presetIcon(label: string): LucideIcon {
  return iconMap.get(label.trim().toLowerCase()) ?? Check;
}

// ─── Mileage quick presets ───────────────────────────────────

export const MILEAGE_PRESETS = ["Unlimited", "100 km/day", "150 km/day", "200 km/day"];

// ─── Terms Engine shared vocabulary ──────────────────────────
// Used by the listing wizard, the edit form and the public listing page so
// all three surfaces stay consistent.

export const BODY_TYPES = [
  "Sedan", "Hatchback", "SUV", "Crossover", "Wagon", "Coupe", "Pickup", "Mini", "Van", "Other",
];

// restricted_use fixed vocabulary (DB text[] column) → human labels shown as
// "Not allowed" chips on provider forms and the public listing.
export const RESTRICTED_USE_OPTIONS: { value: string; label: string }[] = [
  { value: "unpaved_roads",         label: "Unpaved roads" },
  { value: "beach_sand",            label: "Beach / sand driving" },
  { value: "hill_country",          label: "Steep hill-country routes" },
  { value: "flood_water",           label: "Driving through flood water" },
  { value: "long_haul_north_east",  label: "Long-haul North/East trips" },
];

export function restrictedUseLabel(value: string): string {
  return RESTRICTED_USE_OPTIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}

// ─── Common makes in Sri Lanka (datalist suggestions) ────────

export const SL_MAKES = [
  "Toyota", "Suzuki", "Honda", "Nissan", "Mitsubishi", "Mazda", "Daihatsu",
  "Perodua", "Micro", "Kia", "Hyundai", "Tata", "Mahindra", "Renault",
  "BMW", "Mercedes-Benz", "Audi",
  "Bajaj", "TVS", "Yamaha", "Hero", "Piaggio",
];
