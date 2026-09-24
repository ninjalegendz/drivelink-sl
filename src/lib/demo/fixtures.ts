import type { VehicleWithAgency, AgencySnippet } from "@/types/queries";
import type { VehicleSearchParams } from "@/lib/vehicles/search";

// ─── Design-preview sample data ─────────────────────────────
//
// Production has no public listings yet, so every marketplace screen renders
// its empty state, and a redesign cannot be judged against an empty grid.
// These fixtures stand in ONLY when both of these hold:
//
//   1. the app is not a production build, and
//   2. DRIVELINK_DEMO_DATA=1 is set in the local environment,
//
// and even then only when the real query came back empty. They never reach a
// deployed site, and they never mix with real listings. The ids are valid
// UUIDs in a reserved range so the follow-up queries a listing page makes
// (reviews, availability) simply return nothing instead of erroring.

export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DRIVELINK_DEMO_DATA === "1";
}

type DemoAgency = AgencySnippet & { slug: string };

const AGENCIES: Record<string, DemoAgency> = {
  serendib: {
    id: "00000000-0000-4000-8000-00000000a001", name: "Serendib Drive", slug: "serendib-drive", city: "Colombo",
    provider_type: "agency", is_verified: true, reliability_pct: 98, cancellation_count: 0,
    avg_response_minutes: 12, rating_avg: 4.9, rating_count: 38,
  },
  kandy: {
    id: "00000000-0000-4000-8000-00000000a002", name: "Kandy Hill Rentals", slug: "kandy-hill-rentals", city: "Kandy",
    provider_type: "agency", is_verified: true, reliability_pct: 95, cancellation_count: 1,
    avg_response_minutes: 25, rating_avg: 4.7, rating_count: 21,
  },
  nimal: {
    id: "00000000-0000-4000-8000-00000000a003", name: "Nimal's Car Hire", slug: "nimals-car-hire", city: "Galle",
    provider_type: "individual", is_verified: true, reliability_pct: 100, cancellation_count: 0,
    avg_response_minutes: 40, rating_avg: 5, rating_count: 6,
  },
  ella: {
    id: "00000000-0000-4000-8000-00000000a004", name: "Ella Ride Co.", slug: "ella-ride-co", city: "Badulla",
    provider_type: "agency", is_verified: false, reliability_pct: null, cancellation_count: 0,
    avg_response_minutes: 55, rating_avg: 4.8, rating_count: 14,
  },
};

const INTERIOR = "1449965408869-eaa3f722e40d";

/** Unsplash original plus crops of the same frame, so a gallery shows one car
 *  from several distances rather than several different cars. */
function photos(id: string): string[] {
  const base = `https://images.unsplash.com/photo-${id}?auto=format&q=80`;
  return [
    `${base}&w=1600&h=1100&fit=crop`,
    `${base}&w=1200&h=900&fit=crop&crop=focalpoint&fp-x=0.3&fp-y=0.6&fp-z=2`,
    `${base}&w=1200&h=900&fit=crop&crop=focalpoint&fp-x=0.72&fp-y=0.55&fp-z=1.8`,
    `https://images.unsplash.com/photo-${INTERIOR}?auto=format&q=80&w=1200&h=900&fit=crop`,
    `${base}&w=1200&h=900&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.5&fp-z=1.35`,
  ];
}

const FUTURE = "2027-06-30";
const NOW = "2026-09-01T08:00:00Z";

type Seed = Partial<VehicleWithAgency> & {
  slug: string; make: string; model: string; year: number; vehicle_type: VehicleWithAgency["vehicle_type"];
  city: string; daily_rate_lkr: number; agency: keyof typeof AGENCIES; photo: string;
};

function vehicle(n: number, s: Seed): VehicleWithAgency {
  const { agency, photo, ...rest } = s;
  const a = AGENCIES[agency];
  const hire = (rest.insurance_type ?? "hire") === "hire";
  const base: VehicleWithAgency = {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    agency_id: a.id,
    color: null,
    plate_number: null,
    insurance_type: "hire",
    fuel_policy: "full_to_full",
    daily_rate_usd: null,
    monthly_rate_lkr: null,
    deposit_lkr: 25000,
    seats: 5,
    transmission: "automatic",
    features: ["AC", "Bluetooth audio", "Reverse camera", "USB charging"],
    description: null,
    status: "available",
    photos: photos(photo),
    self_drive: true,
    with_driver: false,
    airport_pickup: false,
    mileage_limit: null,
    extra_mileage_lkr: 60,
    rules: [
      "Valid licence or IDP required for self-drive",
      "No smoking inside the vehicle",
      "Condition photos taken at handover and return",
      "Island-wide travel allowed",
    ],
    badges: [],
    is_featured: false,
    fuel_type: "Petrol",
    luggage: 2,
    body_type: null,
    variant: null,
    doors: 4,
    engine_cc: null,
    odometer_km: null,
    weekly_rate_lkr: null,
    included_km_per_day: 150,
    unlimited_km: false,
    refuel_fee_lkr: 1500,
    cleaning_fee_lkr: 2500,
    late_fee_per_hour_lkr: 1000,
    delivery_available: false,
    delivery_fee_lkr: null,
    min_rental_days: 1,
    max_rental_days: null,
    smoking_allowed: false,
    pets_allowed: false,
    ride_hail_allowed: false,
    second_driver_allowed: false,
    min_renter_age: 21,
    min_license_years: 1,
    restricted_use: ["off_road"],
    has_gps_tracker: false,
    has_etc_tag: false,
    per_km_rate_lkr: null,
    tolls_included: null,
    driver_bata_lkr: null,
    verified_vehicle: hire,
    revenue_license_expiry: FUTURE,
    insurance_expiry: FUTURE,
    emission_expiry: FUTURE,
    created_at: NOW,
    updated_at: NOW,
    ...rest,
    agencies: a,
  };
  return base;
}

export const DEMO_VEHICLES: VehicleWithAgency[] = [
  vehicle(1, {
    slug: "demo-toyota-corolla-2019-colombo", make: "Toyota", model: "Corolla Hybrid", year: 2019, vehicle_type: "car",
    city: "Colombo", daily_rate_lkr: 8500, weekly_rate_lkr: 54000, monthly_rate_lkr: 210000, deposit_lkr: 25000,
    agency: "serendib", photo: "1623869675781-80aa31012a5a", fuel_type: "Hybrid", luggage: 3,
    with_driver: true, airport_pickup: true, is_featured: true, delivery_available: true, delivery_fee_lkr: 2000,
    badges: ["Verified Owner", "Tourist Friendly", "Fast Response"], has_etc_tag: true,
    features: ["AC", "Bluetooth audio", "Reverse camera", "Android Auto / CarPlay", "Dashcam", "USB charging"],
    description: "Quiet, frugal hybrid that suits Colombo traffic and the southern expressway alike. Serviced every 5,000 km, with a full-size spare, a dashcam and an ETC tag fitted. We hand over at the airport, your hotel or our Nugegoda yard.",
    per_km_rate_lkr: 90, driver_bata_lkr: 2500, tolls_included: false,
  }),
  vehicle(2, {
    slug: "demo-mitsubishi-pajero-2015-nuwara-eliya", make: "Mitsubishi", model: "Pajero", year: 2015, vehicle_type: "suv",
    city: "Nuwara Eliya", daily_rate_lkr: 16500, deposit_lkr: 50000, seats: 7, transmission: "manual",
    fuel_type: "Diesel", luggage: 4, agency: "kandy", photo: "1486496572940-2bb2341fdbdf", with_driver: true,
    badges: ["Verified Owner", "With Driver Available"], unlimited_km: true, included_km_per_day: null,
    features: ["AC", "Bluetooth audio", "Child seat available", "USB charging"],
    description: "A proper hill-country 4x4. Low range, fresh tyres and plenty of room for seven. Ideal for Horton Plains and the Ella road.",
    per_km_rate_lkr: 120, driver_bata_lkr: 3000, tolls_included: false,
  }),
  vehicle(3, {
    slug: "demo-honda-crv-2019-kandy", make: "Honda", model: "CR-V", year: 2019, vehicle_type: "suv",
    city: "Kandy", daily_rate_lkr: 13000, deposit_lkr: 40000, seats: 5, luggage: 4, agency: "kandy",
    photo: "1519641471654-76ce0107ad1b", airport_pickup: true, badges: ["Verified Owner", "Tourist Friendly"],
    features: ["AC", "Reverse camera", "Parking sensors", "Android Auto / CarPlay", "Sunroof"],
  }),
  vehicle(4, {
    slug: "demo-volvo-xc60-2020-colombo", make: "Volvo", model: "XC60", year: 2020, vehicle_type: "suv",
    city: "Colombo", daily_rate_lkr: 24000, deposit_lkr: 75000, luggage: 4, agency: "serendib",
    photo: "1629897048514-3dd7414fe72a", with_driver: true, airport_pickup: true, is_featured: true,
    badges: ["Verified Owner", "Fast Response"], has_gps_tracker: true,
    features: ["AC", "Leather seats", "Sunroof", "Parking sensors", "Reverse camera", "GPS navigation"],
    per_km_rate_lkr: 150, driver_bata_lkr: 3000, tolls_included: true,
  }),
  vehicle(5, {
    slug: "demo-tesla-model-y-2023-colombo", make: "Tesla", model: "Model Y", year: 2023, vehicle_type: "suv",
    city: "Colombo", daily_rate_lkr: 28000, deposit_lkr: 100000, fuel_type: "Electric", luggage: 4,
    agency: "serendib", photo: "1600661653561-629509216228", airport_pickup: true,
    badges: ["Verified Owner"], features: ["AC", "GPS navigation", "Reverse camera", "Leather seats", "Dashcam"],
    fuel_policy: "same_to_same", refuel_fee_lkr: 0,
  }),
  vehicle(6, {
    slug: "demo-volkswagen-golf-2018-galle", make: "Volkswagen", model: "Golf", year: 2018, vehicle_type: "car",
    city: "Galle", daily_rate_lkr: 7500, deposit_lkr: 20000, agency: "nimal", photo: "1471444928139-48c5bf5173f8",
    insurance_type: "private", badges: [], fuel_policy: "same_to_same",
    description: "My own car, kept garaged in Unawatuna. Easy to park in Galle Fort and happy on the coast road.",
  }),
  vehicle(7, {
    slug: "demo-volkswagen-kombi-1979-galle", make: "Volkswagen", model: "Kombi", year: 1979, vehicle_type: "van",
    city: "Galle", daily_rate_lkr: 22000, deposit_lkr: 0, seats: 7, transmission: "manual", luggage: 5,
    agency: "nimal", photo: "1464219789935-c2d9d9aba644", self_drive: false, with_driver: true,
    badges: ["With Driver Available"], features: ["Bluetooth audio"], per_km_rate_lkr: 110, driver_bata_lkr: 2500,
    description: "A restored classic for slow days along the south coast, always with my driver Sampath.",
  }),
  vehicle(8, {
    slug: "demo-volkswagen-polo-2018-kandy", make: "Volkswagen", model: "Polo", year: 2018, vehicle_type: "car",
    city: "Kandy", daily_rate_lkr: 6500, deposit_lkr: 15000, luggage: 2, agency: "kandy",
    photo: "1541899481282-d53bffe3c35d", insurance_type: "private", badges: [],
  }),
  vehicle(9, {
    slug: "demo-toyota-camry-2020-colombo", make: "Toyota", model: "Camry Hybrid", year: 2020, vehicle_type: "car",
    city: "Colombo", daily_rate_lkr: 14000, deposit_lkr: 0, luggage: 3, fuel_type: "Hybrid",
    agency: "serendib", photo: "1621007947382-bb3c3994e3fb", self_drive: false, with_driver: true, airport_pickup: true,
    badges: ["Verified Owner", "With Driver Available", "Airport Pickup Available"],
    per_km_rate_lkr: 100, driver_bata_lkr: 2500, tolls_included: true,
  }),
  vehicle(10, {
    slug: "demo-royal-enfield-meteor-2021-ella", make: "Royal Enfield", model: "Meteor 350", year: 2021, vehicle_type: "bike",
    city: "Badulla", daily_rate_lkr: 4500, deposit_lkr: 10000, seats: 2, transmission: "manual", luggage: 1,
    agency: "ella", photo: "1558981806-ec527fa84c39", insurance_type: "private", features: ["USB charging"],
    rules: ["Valid licence or IDP required for self-drive", "Renter pays fuel, parking and fines"],
    min_license_years: 2,
  }),
  vehicle(11, {
    slug: "demo-fiat-500-2017-galle", make: "Fiat", model: "500", year: 2017, vehicle_type: "car",
    city: "Galle", daily_rate_lkr: 6000, deposit_lkr: 15000, seats: 4, luggage: 1, agency: "nimal",
    photo: "1549317661-bd32c8ce0db2", insurance_type: "private", badges: [],
  }),
  vehicle(12, {
    slug: "demo-nissan-juke-2019-colombo", make: "Nissan", model: "Juke", year: 2019, vehicle_type: "suv",
    city: "Colombo", daily_rate_lkr: 11000, deposit_lkr: 30000, agency: "serendib",
    photo: "1609521263047-f8f205293f24", badges: ["Verified Owner"],
  }),
];

export const DEMO_AGENCIES = Object.values(AGENCIES);

/**
 * The same filters search_vehicles() applies, in memory. When a date range is
 * given, one listing is shown as already booked so the unavailable state can
 * be reviewed too.
 */
export function demoSearch(p: VehicleSearchParams): VehicleWithAgency[] {
  const q = p.q?.toLowerCase().trim();
  const rows = DEMO_VEHICLES.filter((v) => {
    if (q && !`${v.make} ${v.model} ${v.city} ${v.year}`.toLowerCase().includes(q)) return false;
    if (p.city && v.city !== p.city) return false;
    if (p.type && v.vehicle_type !== p.type) return false;
    if (p.option === "self-drive" && !v.self_drive) return false;
    if (p.option === "with-driver" && !v.with_driver) return false;
    if (p.option === "airport-pickup" && !v.airport_pickup) return false;
    if (p.maxPrice && v.daily_rate_lkr > p.maxPrice) return false;
    if (p.insurance === "hire" && v.insurance_type !== "hire") return false;
    return true;
  }).map((v) => (p.from && p.to && v.slug === "demo-volvo-xc60-2020-colombo" ? { ...v, booked_in_range: true } : v));

  const bookable = rows.filter((v) => !v.booked_in_range);
  const taken = rows.filter((v) => v.booked_in_range);
  const offset = p.offset ?? 0;
  return [...bookable, ...taken].slice(offset, offset + (p.limit ?? 24));
}

export function demoVehicleBySlug(slug: string): VehicleWithAgency | null {
  return DEMO_VEHICLES.find((v) => v.slug === slug) ?? null;
}
