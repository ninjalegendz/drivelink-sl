import type { VehicleType } from "@/types/database";
import type { RentalOption } from "@/data/vehicles";

export interface Landing {
  slug: string;
  title: string;        // <title> / SEO
  h1: string;           // hero headline
  subtitle: string;     // hero subcopy
  intro: string;        // SEO body paragraph
  filters: {
    type?: VehicleType;
    option?: RentalOption;
    city?: string;
  };
}

// Curated SEO landing pages (plan §11). Each maps a search-intent keyword to a
// real filtered listing view with its own metadata + copy + internal links.
export const LANDINGS: Landing[] = [
  {
    slug: "self-drive-car-rental-sri-lanka",
    title: "Self-Drive Car Rental in Sri Lanka",
    h1: "Self-drive car rental in Sri Lanka",
    subtitle: "Verified self-drive cars from trusted local owners, with clear deposit, mileage and licence rules and no platform fee.",
    intro: "Explore Sri Lanka at your own pace. DriveLink lists verified self-drive cars with transparent deposits, mileage allowances and licence requirements. Many owners help arrange the International Driving Permit (IDP) endorsement that tourists need to drive locally.",
    filters: { option: "self-drive", type: "car" },
  },
  {
    slug: "car-rental-with-driver-sri-lanka",
    title: "Car Rental With Driver in Sri Lanka",
    h1: "Car rental with a driver in Sri Lanka",
    subtitle: "Sit back while a professional local driver takes you around. Ideal for tours and travellers who would rather not drive.",
    intro: "Prefer not to drive? Book a verified car with an experienced, English-speaking local driver. It is great for multi-day island tours, day trips and stress-free travel, with no permit needed.",
    filters: { option: "with-driver", type: "car" },
  },
  {
    slug: "van-with-driver-sri-lanka",
    title: "Van With Driver in Sri Lanka",
    h1: "Vans with driver in Sri Lanka",
    subtitle: "Spacious vans and minibuses with a driver, perfect for groups, families and airport transfers.",
    intro: "Travelling as a group? DriveLink lists verified vans and minibuses with professional drivers. Expect air-conditioned comfort, room for luggage, and clear pricing for round trips and airport transfers.",
    filters: { option: "with-driver", type: "van" },
  },
  {
    slug: "bike-rental-sri-lanka",
    title: "Bike & Scooter Rental in Sri Lanka",
    h1: "Bike & scooter rental in Sri Lanka",
    subtitle: "Scooters and motorbikes for coastal cruising and hill-country rides, with low deposits and helmets included.",
    intro: "From beach-town scooters to classic motorbikes, DriveLink lists verified two-wheelers across Sri Lanka's tourist areas, with low deposits, helmets included, and honest condition rules.",
    filters: { type: "bike" },
  },
  {
    slug: "airport-car-rental-sri-lanka",
    title: "Airport Car Rental & Pickup in Sri Lanka (CMB)",
    h1: "Airport pickup & car rental in Sri Lanka",
    subtitle: "Get collected at Bandaranaike International (CMB), or pick up a car the moment you land.",
    intro: "Arriving at Colombo's Bandaranaike International Airport (CMB)? DriveLink lists verified providers offering airport pickup and drop-off. Share your flight details and your driver plans around your arrival time.",
    filters: { option: "airport-pickup" },
  },
  {
    slug: "colombo-car-rental",
    title: "Colombo Car Rental",
    h1: "Car rental in Colombo",
    subtitle: "Verified cars in Sri Lanka's capital, self-drive or with a driver.",
    intro: "Renting in Colombo? Compare verified cars from local owners and agencies, with clear pricing, deposits and rules. Choose self-drive or with-driver options, plus airport transfers.",
    filters: { city: "Colombo" },
  },
  {
    slug: "negombo-car-rental",
    title: "Negombo Car Rental",
    h1: "Car rental in Negombo",
    subtitle: "Handy for the airport and the west coast, with verified Negombo rentals.",
    intro: "Negombo is minutes from the airport and a popular first or last stop. Browse verified cars and vans here, with airport pickup options and transparent terms.",
    filters: { city: "Negombo" },
  },
  {
    slug: "ella-bike-rental",
    title: "Ella Bike Rental",
    h1: "Bike rental in Ella",
    subtitle: "Explore the hill country's viewpoints and tea trails on two wheels.",
    intro: "Ella's winding roads and viewpoints are made for two wheels. DriveLink lists verified bikes and scooters in Ella with clear rules and prior-experience guidance for the hills.",
    filters: { city: "Ella", type: "bike" },
  },
  {
    slug: "mirissa-bike-rental",
    title: "Mirissa Bike & Scooter Rental",
    h1: "Bike & scooter rental in Mirissa",
    subtitle: "Cruise the south coast, from Mirissa to Weligama and the surf points.",
    intro: "Renting a scooter in Mirissa is the easiest way to reach the beaches, surf points and Weligama. Browse verified two-wheelers with low deposits and honest condition checks.",
    filters: { city: "Mirissa", type: "bike" },
  },
  {
    slug: "kandy-van-rental",
    title: "Kandy Van Rental",
    h1: "Van rental in Kandy",
    subtitle: "Group-friendly vans in the hill capital, with driver available.",
    intro: "Heading into the hill country from Kandy? DriveLink lists verified vans and minibuses with drivers, ideal for families and groups exploring the Temple of the Tooth, tea country and beyond.",
    filters: { city: "Kandy", type: "van" },
  },
  {
    slug: "sri-lanka-road-trip-car-rental",
    title: "Sri Lanka Road Trip Car Rental",
    h1: "Road-trip car rental in Sri Lanka",
    subtitle: "Plan the full island loop with verified cars and SUVs built for long-distance travel.",
    intro: "Planning the classic Sri Lanka loop? Find verified cars and SUVs suited to long-distance road trips, with clear mileage allowances and self-drive or with-driver options.",
    filters: { type: "car" },
  },
  {
    slug: "tourist-vehicle-rental-sri-lanka",
    title: "Tourist Vehicle Rental in Sri Lanka",
    h1: "Tourist vehicle rental in Sri Lanka",
    subtitle: "Cars, vans, bikes and tuk-tuks from verified, tourist-friendly providers.",
    intro: "DriveLink is Sri Lanka's verified vehicle rental network for travellers. Rent cars, SUVs, vans, bikes and tuk-tuks, self-drive or with a driver, plus airport pickups, from verified providers with clear rules and no platform fee.",
    filters: {},
  },
];

export function getLanding(slug: string): Landing | undefined {
  return LANDINGS.find((l) => l.slug === slug);
}
