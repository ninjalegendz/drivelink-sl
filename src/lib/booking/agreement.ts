// Digital rental agreement (migration 051's `booking_agreements` table).
//
// One place for the clause copy (lawyer-reviewable) and the snapshot builder
// that freezes it at confirmation time. The stored `terms` jsonb is rendered
// as-is on the agreement page later, no live lookups, so every value here
// must already be resolved (numbers, labels, full sentences) at build time.
//
// The platform holds no money and is not a party to the rental: the
// agreement is between the renter and the Rental Page owner. DriveLink is
// the venue / record-keeper only (see parties.platform_disclaimer below).

import { calcBookingPriceByDays } from "@/lib/bookings/pricing";
import { restrictedUseLabel } from "@/data/vehicle-presets";
import { formatLKR, insuranceLabel, fuelPolicyLabel } from "@/lib/vehicles/format";
import type { InsuranceType, FuelPolicy } from "@/types/database";

export const AGREEMENT_TEMPLATE_VERSION = "v1";

// ─── Inputs (only the fields the builder reads) ─────────────────────────

export interface AgreementBookingInput {
  id:             string;
  start_date:     string;
  end_date:       string;
  start_time:     string;
  end_time:       string;
  start_at:       string;
  end_at:         string;
  total_days:     number;
  daily_rate_lkr: number;
  subtotal_lkr:   number;
  deposit_lkr:    number | null;
}

export interface AgreementVehicleInput {
  make:                  string;
  model:                 string;
  year:                  number;
  plate_number:          string | null;
  fuel_type:             string | null;
  insurance_type:        InsuranceType;
  fuel_policy:           FuelPolicy;
  deposit_lkr:           number;
  monthly_rate_lkr:      number | null;
  weekly_rate_lkr:       number | null;
  included_km_per_day:   number | null;
  unlimited_km:          boolean;
  mileage_limit:         string | null;
  extra_mileage_lkr:     number | null;
  refuel_fee_lkr:        number;
  cleaning_fee_lkr:      number;
  late_fee_per_hour_lkr: number | null;
  self_drive:            boolean;
  with_driver:           boolean;
  per_km_rate_lkr:       number | null;
  tolls_included:        boolean | null;
  driver_bata_lkr:       number | null;
  smoking_allowed:       boolean;
  pets_allowed:          boolean;
  ride_hail_allowed:     boolean;
  second_driver_allowed: boolean;
  restricted_use:        string[];
  has_gps_tracker:       boolean;
  has_etc_tag:           boolean;
  min_renter_age:        number;
  min_license_years:     number;
}

export interface AgreementPageInput {
  name:            string;
  page_type:       "personal" | "business";
  whatsapp_number: string;
}

export interface AgreementRenterInput {
  full_name:  string;
  nic_number: string | null;
}

export interface BuildAgreementArgs {
  booking:       AgreementBookingInput;
  vehicle:       AgreementVehicleInput;
  page:          AgreementPageInput;
  renterProfile: AgreementRenterInput;
}

// ─── Output shape (this IS the stored `terms` jsonb) ────────────────────

export interface AgreementTerms {
  parties: {
    renter: { name: string; nic_masked: string | null };
    page:   { name: string; page_type: "personal" | "business"; page_type_label: string; whatsapp_number: string };
    platform_disclaimer: string;
  };
  vehicle: {
    make: string; model: string; year: number; plate_number: string | null;
    fuel_type: string | null;
    insurance_type: InsuranceType; insurance_type_label: string;
    fuel_policy: FuelPolicy; fuel_policy_label: string;
  };
  period: {
    start_at: string; end_at: string;
    start_date: string; end_date: string;
    start_time: string; end_time: string;
    total_days: number;
  };
  pricing: {
    daily_rate_lkr:   number;
    total_days:       number;
    subtotal_lkr:     number;
    weekly_rate_lkr:  number | null;
    monthly_rate_lkr: number | null;
    breakdown: { full_months: number; months_cost_lkr: number; remaining_days: number; days_cost_lkr: number };
  };
  deposit: {
    amount_lkr:        number;
    refund_terms:      string;
    banned_securities: string;
  };
  mileage: {
    unlimited:            boolean;
    included_km_per_day:  number | null;
    extra_km_rate_lkr:    number | null;
    label:                string;
  };
  fuel: {
    policy:             FuelPolicy;
    policy_label:       string;
    fuel_type:          string | null;
    wrong_fuel_clause:  string;
    refuel_fee_lkr:     number;
  };
  fees: {
    cleaning_fee_lkr:      number;
    cleaning_fee_note:     string;
    late_fee_per_hour_lkr: number | null;
    late_fee_label:        string;
    grace:                 string;
  };
  usage: {
    named_drivers_only:    true;
    second_driver_allowed: boolean;
    ride_hail_allowed:     boolean;
    smoking_allowed:       boolean;
    pets_allowed:          boolean;
    restricted_use:        string[]; // human labels, already resolved
    geographic_note:       string;
    driver_requirement:    string | null; // only meaningful when self_drive
  };
  disclosures: {
    gps_tracker:      boolean;
    gps_tracker_note: string | null;
    etc_tag:          boolean;
    etc_tag_note:     string | null;
  };
  with_driver: {
    per_km_rate_lkr: number | null;
    tolls_included:  boolean | null;
    driver_bata_lkr: number | null;
  } | null;
  liability: {
    insurance_type: InsuranceType;
    note:           string;
    prominent:      boolean; // true for the private-insurance warning, UI should render it loudly
    breach_full_liability: string;
    accident_protocol:     string;
  };
  fines_tolls: {
    renter_liable_note:      string;
    owner_claim_window_days: number;
    owner_claim_note:        string;
  };
  late_return: {
    grace:            string;
    hourly_fee_label: string;
    after_6h:         string;
    after_24h:        string;
  };
  disputes: {
    mediation_first: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Mask the middle of a NIC, keeping the first 2 and last 2 characters visible. */
function maskNic(nic: string | null | undefined): string | null {
  if (!nic) return null;
  const clean = nic.trim();
  if (clean.length <= 4) return clean;
  const visible = 2;
  const stars = "*".repeat(Math.max(clean.length - visible * 2, 3));
  return `${clean.slice(0, visible)}${stars}${clean.slice(-visible)}`;
}

function mileageLabel(v: AgreementVehicleInput): string {
  if (v.unlimited_km) return "Unlimited kilometres";
  if (v.included_km_per_day != null) return `${v.included_km_per_day} km/day included`;
  if (v.mileage_limit) {
    return /unlimited/i.test(v.mileage_limit) ? "Unlimited kilometres" : `${v.mileage_limit} included`;
  }
  return "Not specified";
}

function lateFeeLabel(v: AgreementVehicleInput): string {
  return v.late_fee_per_hour_lkr
    ? `${formatLKR(v.late_fee_per_hour_lkr)}/hour`
    : "Daily rate ÷ 8 per hour";
}

// ─── The builder ─────────────────────────────────────────────────────────

export function buildAgreementTerms({ booking, vehicle, page, renterProfile }: BuildAgreementArgs): AgreementTerms {
  const depositAmount = booking.deposit_lkr ?? vehicle.deposit_lkr ?? 0;

  // Same function the booking row's own subtotal_lkr was computed with
  // (see /api/bookings/route.ts), so the breakdown always agrees with the
  // stored total, no independent re-derivation that could drift.
  const breakdown = calcBookingPriceByDays(booking.total_days, booking.daily_rate_lkr, vehicle.monthly_rate_lkr);

  const restrictedLabels = (vehicle.restricted_use ?? []).map(restrictedUseLabel);
  const geographicNote = restrictedLabels.length > 0
    ? `Travel is permitted anywhere in Sri Lanka except: ${restrictedLabels.join(", ")}.`
    : "Travel is permitted anywhere within Sri Lanka.";

  const driverRequirement = vehicle.self_drive
    ? `Driver must be ${vehicle.min_renter_age}+${vehicle.min_license_years > 0 ? `, licence held ${vehicle.min_license_years}+ years` : ""}.`
    : null;

  const liabilityNote = vehicle.insurance_type === "hire"
    ? "This vehicle carries hire insurance: renter liability is limited to the insurance excess and insurer-excluded items unless the agreement is breached."
    : "This vehicle is insured under a PRIVATE (non-hire) policy. Private insurance can exclude cover when the vehicle is rented out for payment. If the insurer declines or reduces a claim on that basis, the renter is fully liable for the resulting repair, replacement, or loss-of-use cost. Confirm cover with the owner before you drive.";

  const feeLateLabel = lateFeeLabel(vehicle);

  return {
    parties: {
      renter: {
        name:       renterProfile.full_name,
        nic_masked: maskNic(renterProfile.nic_number),
      },
      page: {
        name:            page.name,
        page_type:       page.page_type,
        page_type_label: page.page_type === "business" ? "Business" : "Personal",
        whatsapp_number: page.whatsapp_number,
      },
      platform_disclaimer:
        "This agreement is between the parties above. DriveLink provides the introduction and record-keeping only and is not a party to this rental.",
    },
    vehicle: {
      make:  vehicle.make,
      model: vehicle.model,
      year:  vehicle.year,
      plate_number: vehicle.plate_number,
      fuel_type: vehicle.fuel_type,
      insurance_type: vehicle.insurance_type,
      insurance_type_label: insuranceLabel(vehicle.insurance_type),
      fuel_policy: vehicle.fuel_policy,
      fuel_policy_label: fuelPolicyLabel(vehicle.fuel_policy),
    },
    period: {
      start_at:   booking.start_at,
      end_at:     booking.end_at,
      start_date: booking.start_date,
      end_date:   booking.end_date,
      start_time: booking.start_time,
      end_time:   booking.end_time,
      total_days: booking.total_days,
    },
    pricing: {
      daily_rate_lkr:   booking.daily_rate_lkr,
      total_days:       booking.total_days,
      subtotal_lkr:     booking.subtotal_lkr,
      weekly_rate_lkr:  vehicle.weekly_rate_lkr,
      monthly_rate_lkr: vehicle.monthly_rate_lkr,
      breakdown: {
        full_months:    breakdown.fullMonths,
        months_cost_lkr: breakdown.monthsCost,
        remaining_days: breakdown.remainingDays,
        days_cost_lkr:  breakdown.daysCost,
      },
    },
    deposit: {
      amount_lkr: depositAmount,
      refund_terms:
        "Returned in full at the return handshake unless a damage claim with evidence is filed. Partial returns require a written reason. Maximum hold 7 days pending a written estimate. Renter is entitled to a second estimate.",
      banned_securities:
        "No passports, original licences, original NICs, blank cheques or valuables may be taken as security.",
    },
    mileage: {
      unlimited:           vehicle.unlimited_km,
      included_km_per_day: vehicle.included_km_per_day,
      extra_km_rate_lkr:   vehicle.unlimited_km ? null : vehicle.extra_mileage_lkr,
      label: mileageLabel(vehicle),
    },
    fuel: {
      policy: vehicle.fuel_policy,
      policy_label: fuelPolicyLabel(vehicle.fuel_policy),
      fuel_type: vehicle.fuel_type,
      wrong_fuel_clause:
        "Wrong-fuel damage is fully at the renter's cost, including recovery and repair, plus loss-of-hire.",
      refuel_fee_lkr: vehicle.refuel_fee_lkr,
    },
    fees: {
      cleaning_fee_lkr:  vehicle.cleaning_fee_lkr,
      cleaning_fee_note: "Only charged if the vehicle is returned excessively dirty.",
      late_fee_per_hour_lkr: vehicle.late_fee_per_hour_lkr,
      late_fee_label: feeLateLabel,
      grace: "2 hours",
    },
    usage: {
      named_drivers_only: true,
      second_driver_allowed: vehicle.second_driver_allowed,
      ride_hail_allowed:     vehicle.ride_hail_allowed,
      smoking_allowed:       vehicle.smoking_allowed,
      pets_allowed:          vehicle.pets_allowed,
      restricted_use:        restrictedLabels,
      geographic_note:       geographicNote,
      driver_requirement:    driverRequirement,
    },
    disclosures: {
      gps_tracker: vehicle.has_gps_tracker,
      gps_tracker_note: vehicle.has_gps_tracker
        ? "This vehicle has a GPS tracker fitted, disclosed here for your awareness."
        : null,
      etc_tag: vehicle.has_etc_tag,
      etc_tag_note: vehicle.has_etc_tag
        ? "This vehicle has an ETC (expressway) tag fitted. Tag charges during the rental window are billed to the renter."
        : null,
    },
    with_driver: vehicle.with_driver
      ? {
          per_km_rate_lkr: vehicle.per_km_rate_lkr,
          tolls_included:  vehicle.tolls_included,
          driver_bata_lkr: vehicle.driver_bata_lkr,
        }
      : null,
    liability: {
      insurance_type: vehicle.insurance_type,
      note: liabilityNote,
      prominent: vehicle.insurance_type === "private",
      breach_full_liability:
        "Unlisted drivers, DUI, prohibited use or invalid licence = agreement breach, full liability.",
      accident_protocol:
        "Do not move the vehicle, call 119, obtain a police report (insurance requires it), call the owner, do not settle at the roadside.",
    },
    fines_tolls: {
      renter_liable_note:
        "The renter is liable for all fines, tickets and tolls incurred while the vehicle was in their possession during the rental window.",
      owner_claim_window_days: 30,
      owner_claim_note:
        "The owner has up to 30 days after the vehicle is returned to raise a fine or toll claim, with the official notice attached.",
    },
    late_return: {
      grace: "2 hours",
      hourly_fee_label: feeLateLabel,
      after_6h:
        "After 6 hours late, a full extra day's rental is charged in addition to the hourly late fee.",
      after_24h:
        "If the vehicle is more than 24 hours overdue and the renter is unreachable, this is treated as misappropriation of the vehicle and will be reported to the police.",
    },
    disputes: {
      mediation_first:
        "Both parties agree to raise problems through DriveLink's dispute process before police/courts, except emergencies.",
    },
  };
}

// ─── Row shape + shared select, mirrors inspection-types.ts's pattern ───

export interface AcceptMeta {
  ua: string;
  ts: string;
}

export interface BookingAgreementRow {
  id:                 string;
  booking_id:         string;
  template_version:   string;
  terms:              AgreementTerms;
  renter_accepted_at: string | null;
  renter_accept_meta: AcceptMeta | null;
  owner_accepted_at:  string | null;
  owner_accept_meta:  AcceptMeta | null;
  created_at:         string;
}

export const AGREEMENT_SELECT =
  "id, booking_id, template_version, terms, renter_accepted_at, renter_accept_meta, " +
  "owner_accepted_at, owner_accept_meta, created_at";
