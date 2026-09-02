import { sriLankaToday } from "@/lib/dates/sri-lanka";

interface VehicleCompliance {
  verified_vehicle: boolean;
  insurance_type?: string | null;
  insurance_expiry?: string | null;
  revenue_license_expiry?: string | null;
}

export interface ListingPublicationFacts {
  plate_number?: string | null;
  photos?: string[] | null;
  self_drive?: boolean | null;
  with_driver?: boolean | null;
  daily_rate_lkr?: number | null;
  rejection_reason?: string | null;
  listing_authority_basis?: string | null;
  listing_authority_declared?: boolean | null;
  listing_authority_confirmed_at?: string | null;
  listing_authority_confirmed_by?: string | null;
  listing_authority_declaration_version?: string | null;
}

export function listingPublicationProblem(
  vehicle: ListingPublicationFacts,
  { approvalClearsRejection = false }: { approvalClearsRejection?: boolean } = {},
): string | null {
  if (!vehicle.plate_number?.trim() || vehicle.plate_number.trim().length < 3) {
    return "Add the registration plate number before this listing can be published.";
  }
  if ((vehicle.photos?.length ?? 0) < 4) {
    return "Add at least four clear vehicle photos before this listing can be published.";
  }
  if (!vehicle.self_drive && !vehicle.with_driver) {
    return "Choose self-drive, with driver, or both before this listing can be published.";
  }
  if ((vehicle.daily_rate_lkr ?? 0) < 500) {
    return "Add a valid daily price before this listing can be published.";
  }
  if (
    vehicle.listing_authority_declared !== true
    || !["registered_owner", "authorized_operator"].includes(vehicle.listing_authority_basis ?? "")
    || !vehicle.listing_authority_confirmed_at
    || !vehicle.listing_authority_confirmed_by
    || vehicle.listing_authority_declaration_version !== "vehicle-authority-v1"
  ) {
    return "Record who owns or authorised this vehicle before the listing can be published.";
  }
  if (!approvalClearsRejection && vehicle.rejection_reason) {
    return "This listing was rejected. Fix the stated reason and resubmit it for admin review.";
  }
  return null;
}

export function hasCurrentVehicleCompliance(vehicle: VehicleCompliance): boolean {
  const today = sriLankaToday();
  return hasCurrentHireInsurance(vehicle)
    && Boolean(vehicle.revenue_license_expiry && vehicle.revenue_license_expiry >= today);
}

export function hasCurrentHireInsurance(vehicle: VehicleCompliance): boolean {
  const today = sriLankaToday();
  return vehicle.insurance_type === "hire"
    && Boolean(vehicle.insurance_expiry && vehicle.insurance_expiry >= today);
}

export function isCurrentVerifiedVehicle(vehicle: VehicleCompliance): boolean {
  return vehicle.verified_vehicle && hasCurrentVehicleCompliance(vehicle);
}
