// Self-drive eligibility, now that DriveLink no longer reviews driving licences.
//
// The licence is checked where it always had to be checked anyway: by the
// owner, on the original document, at the handover. A scan reviewed days
// earlier never replaced that, and made every renter wait on an admin before
// they could ask for a car.
//
// What DriveLink can still confirm from its own records is age, because the
// identity check reads a date of birth from the passport, NIC or licence the
// renter verified with. So age is the only rule enforced here. A vehicle's
// "minimum years holding a licence" stays on the listing as the owner's own
// handover requirement: DriveLink holds no verified issue date to compare it
// against, and enforcing it anyway would be a check it cannot actually make.

export type ForeignPermitType = "idp_1968" | "aa_ceylon_endorsement" | "dmt_airport_permit" | "none";

// Still needed to label older bookings that recorded a declared permit.
export const FOREIGN_PERMIT_LABELS: Record<ForeignPermitType, string> = {
  idp_1968: "International Driving Permit (1949/1968)",
  aa_ceylon_endorsement: "AA Ceylon endorsement",
  dmt_airport_permit: "DMT airport permit",
  none: "None of these yet",
};

export interface DriverAgeRecord {
  date_of_birth: string | null;
}

export interface SelfDriveRules {
  minRenterAge: number | null;
}

export interface EligibleDriver {
  /** Null when the identity check did not return a date of birth. */
  ageAtPickup: number | null;
}

export type EligibilityResult =
  | { ok: true; driver: EligibleDriver }
  | { ok: false; code: "minimum_age"; message: string };

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function completedYears(from: string, on: string): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [onYear, onMonth, onDay] = on.split("-").map(Number);
  let years = onYear - fromYear;
  if (onMonth < fromMonth || (onMonth === fromMonth && onDay < fromDay)) years -= 1;
  return years;
}

export function assessSelfDriveEligibility(
  record: DriverAgeRecord,
  rules: SelfDriveRules,
  pickupDate: string,
): EligibilityResult {
  const minAge = rules.minRenterAge ?? 18;

  if (!isDateOnly(record.date_of_birth) || !isDateOnly(pickupDate)) {
    // No verified birth date to compare. Refusing a renter who has passed the
    // identity check over a field the document did not expose would be worse
    // than the owner confirming age from the original licence at handover.
    return { ok: true, driver: { ageAtPickup: null } };
  }

  const ageAtPickup = completedYears(record.date_of_birth, pickupDate);
  if (ageAtPickup < minAge) {
    return {
      ok: false,
      code: "minimum_age",
      message: `This vehicle requires a driver aged ${minAge} or older at pickup.`,
    };
  }
  return { ok: true, driver: { ageAtPickup } };
}
