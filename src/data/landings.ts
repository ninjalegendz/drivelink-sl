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
    subtitle: "Self-drive cars from reviewed Rental Pages, with visible deposit, mileage, insurance and licence rules. DriveLink's confirmation fee is Rs. 0.",
    intro: "Explore Sri Lanka at your own pace. DriveLink shows which self-drive cars have completed the stronger Verified Vehicle document review and which are Basic listings. Compare deposits, mileage allowances, insurance labels and licence requirements before requesting.",
    filters: { option: "self-drive", type: "car" },
  },
  {
    slug: "car-rental-with-driver-sri-lanka",
    title: "Car Rental With Driver in Sri Lanka",
    h1: "Car rental with a driver in Sri Lanka",
    subtitle: "Compare cars offered with a driver for tours, day trips and travellers who would rather not drive.",
    intro: "Prefer not to drive? Browse cars whose Rental Pages offer a driver. Confirm the named driver, language, working hours, route limits, meals, accommodation and extra charges in booking chat before handover.",
    filters: { option: "with-driver", type: "car" },
  },
  {
    slug: "van-with-driver-sri-lanka",
    title: "Van With Driver in Sri Lanka",
    h1: "Vans with driver in Sri Lanka",
    subtitle: "Spacious vans and minibuses with a driver, perfect for groups, families and airport transfers.",
    intro: "Travelling as a group? Compare vans and minibuses whose Rental Pages offer a driver. Check the actual seating, luggage space, air conditioning, driver terms and full trip price before confirming handover.",
    filters: { option: "with-driver", type: "van" },
  },
  {
    slug: "bike-rental-sri-lanka",
    title: "Bike & Scooter Rental in Sri Lanka",
    h1: "Bike & scooter rental in Sri Lanka",
    subtitle: "Compare scooters and motorbikes for coastal and hill-country travel, with the deposit and included equipment shown per listing.",
    intro: "From beach-town scooters to motorbikes, DriveLink shows each listing's deposit, insurance label, included equipment and recorded checks. Confirm helmet condition and your legal licence eligibility before taking a bike.",
    filters: { type: "bike" },
  },
  {
    slug: "airport-car-rental-sri-lanka",
    title: "Airport Car Rental & Pickup in Sri Lanka (CMB)",
    h1: "Airport pickup & car rental in Sri Lanka",
    subtitle: "Get collected at Bandaranaike International (CMB), or pick up a car the moment you land.",
    intro: "Arriving at Bandaranaike International Airport (CMB)? Compare listings that offer airport handover or collection. Send flight details in booking chat and confirm the meeting point, delay policy and any delivery charge with the Rental Page.",
    filters: { option: "airport-pickup" },
  },
  {
    slug: "colombo-car-rental",
    title: "Colombo Car Rental",
    h1: "Car rental in Colombo",
    subtitle: "Compare Colombo cars for self-drive or with-driver bookings, with listing checks shown clearly.",
    intro: "Renting in Colombo? Compare cars from local Rental Pages, with visible pricing, deposits, insurance labels and rules. Choose self-drive or with-driver options and check whether airport handover is offered separately.",
    filters: { city: "Colombo" },
  },
  {
    slug: "negombo-car-rental",
    title: "Negombo Car Rental",
    h1: "Car rental in Negombo",
    subtitle: "Compare Negombo rentals for the airport and west coast, with each listing's checks shown.",
    intro: "Negombo is close to the airport and a popular first or last stop. Browse cars and vans with visible terms, then confirm the exact airport meeting point and charge in booking chat.",
    filters: { city: "Negombo" },
  },
  {
    slug: "ella-bike-rental",
    title: "Ella Bike Rental",
    h1: "Bike rental in Ella",
    subtitle: "Explore the hill country's viewpoints and tea trails on two wheels.",
    intro: "Ella's winding roads require confident riding. Compare bikes and scooters with visible insurance, equipment and eligibility details, and do not book unless your licence and experience fit the listing's rules.",
    filters: { city: "Ella", type: "bike" },
  },
  {
    slug: "mirissa-bike-rental",
    title: "Mirissa Bike & Scooter Rental",
    h1: "Bike & scooter rental in Mirissa",
    subtitle: "Cruise the south coast, from Mirissa to Weligama and the surf points.",
    intro: "A scooter can make short south-coast trips easier. Compare two-wheelers with visible deposits, insurance labels and condition checks, then inspect the helmet and vehicle before handover.",
    filters: { city: "Mirissa", type: "bike" },
  },
  {
    slug: "kandy-van-rental",
    title: "Kandy Van Rental",
    h1: "Van rental in Kandy",
    subtitle: "Group-friendly vans in the hill capital, with driver available.",
    intro: "Heading into the hill country from Kandy? Compare vans and minibuses offered with drivers. Confirm seats, luggage, route, driver hours, accommodation and the full trip price before pickup.",
    filters: { city: "Kandy", type: "van" },
  },
  {
    slug: "sri-lanka-road-trip-car-rental",
    title: "Sri Lanka Road Trip Car Rental",
    h1: "Road-trip car rental in Sri Lanka",
    subtitle: "Plan an island loop with cars and SUVs whose mileage, insurance and rental terms are visible.",
    intro: "Planning a Sri Lanka road trip? Compare cars and SUVs by rental mode, mileage allowance, insurance label and condition evidence. Ask the Rental Page about route limits and breakdown support before confirming.",
    filters: { type: "car" },
  },
  {
    slug: "tourist-vehicle-rental-sri-lanka",
    title: "Tourist Vehicle Rental in Sri Lanka",
    h1: "Tourist vehicle rental in Sri Lanka",
    subtitle: "Cars, vans, bikes and tuk-tuks with provider, document and traveller-help labels shown separately.",
    intro: "DriveLink is Sri Lanka's vehicle rental marketplace for travellers. Compare cars, SUVs, vans, bikes and tuk-tuks, self-drive or with a driver, plus airport pickups. Each listing shows its provider and recorded checks. Booking requests cost Rs. 0.",
    filters: {},
  },
];

export function getLanding(slug: string): Landing | undefined {
  return LANDINGS.find((l) => l.slug === slug);
}
