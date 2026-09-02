export type LicenseJurisdiction = "sri_lanka" | "foreign";
export type LicenseReviewStatus = "not_submitted" | "pending" | "verified" | "rejected";
export type ForeignPermitType = "idp_1968" | "aa_ceylon_endorsement" | "dmt_airport_permit" | "none";

export const FOREIGN_PERMIT_TYPES: ForeignPermitType[] = [
  "idp_1968",
  "aa_ceylon_endorsement",
  "dmt_airport_permit",
  "none",
];

export const FOREIGN_PERMIT_LABELS: Record<ForeignPermitType, string> = {
  idp_1968: "International Driving Permit (1949/1968)",
  aa_ceylon_endorsement: "AA Ceylon endorsement",
  dmt_airport_permit: "DMT airport permit",
  none: "None of these yet",
};

export interface DriverLicenceRecord {
  license_front_url: string | null;
  license_back_url: string | null;
  date_of_birth: string | null;
  license_issued_on: string | null;
  license_expires_on: string | null;
  license_jurisdiction: LicenseJurisdiction | null;
  license_review_status: LicenseReviewStatus | null;
  license_reviewed_at: string | null;
}

export interface SelfDriveRules {
  minRenterAge: number | null;
  minLicenseYears: number | null;
}

export interface EligibleDriver {
  ageAtPickup: number;
  licenseYearsAtPickup: number;
  jurisdiction: LicenseJurisdiction;
  reviewedAt: string;
  foreignPermitType: ForeignPermitType | null;
}

export type EligibilityResult =
  | { ok: true; driver: EligibleDriver }
  | { ok: false; code: "licence_review_required" | "licence_expired" | "minimum_age" | "minimum_experience" | "foreign_permit_required"; message: string };

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
  record: DriverLicenceRecord,
  rules: SelfDriveRules,
  pickupDate: string,
  foreignPermitType: ForeignPermitType | null,
): EligibilityResult {
  const reviewed = record.license_review_status === "verified";
  const dateOfBirth = record.date_of_birth;
  const issuedOn = record.license_issued_on;
  const expiresOn = record.license_expires_on;
  const jurisdiction = record.license_jurisdiction;
  const reviewedAt = record.license_reviewed_at;
  if (
    !reviewed
    || !record.license_front_url
    || !record.license_back_url
    || !isDateOnly(dateOfBirth)
    || !isDateOnly(issuedOn)
    || !isDateOnly(expiresOn)
    || !jurisdiction
    || !reviewedAt
    || issuedOn < dateOfBirth
    || expiresOn < issuedOn
  ) {
    return {
      ok: false,
      code: "licence_review_required",
      message: "Your driving licence needs DriveLink review before you can request a self-drive rental. Update it in your account, then wait for approval.",
    };
  }
  if (!isDateOnly(pickupDate) || expiresOn < pickupDate) {
    return {
      ok: false,
      code: "licence_expired",
      message: "Your driving licence expires before this pickup. Upload a current licence for review before requesting self-drive.",
    };
  }

  const ageAtPickup = completedYears(dateOfBirth, pickupDate);
  const licenseYearsAtPickup = completedYears(issuedOn, pickupDate);
  const minAge = rules.minRenterAge ?? 18;
  const minExperience = rules.minLicenseYears ?? 0;
  if (ageAtPickup < minAge) {
    return {
      ok: false,
      code: "minimum_age",
      message: `This vehicle requires a driver aged ${minAge} or older at pickup.`,
    };
  }
  if (licenseYearsAtPickup < minExperience) {
    return {
      ok: false,
      code: "minimum_experience",
      message: `This vehicle requires at least ${minExperience} year${minExperience === 1 ? "" : "s"} of driving-licence experience at pickup.`,
    };
  }
  if (jurisdiction === "foreign" && (!foreignPermitType || foreignPermitType === "none")) {
    return {
      ok: false,
      code: "foreign_permit_required",
      message: "Choose the driving permit you will show in original form at handover, or choose a with-driver rental.",
    };
  }

  return {
    ok: true,
    driver: {
      ageAtPickup,
      licenseYearsAtPickup,
      jurisdiction,
      reviewedAt,
      foreignPermitType: jurisdiction === "foreign" ? foreignPermitType : null,
    },
  };
}

export function isForeignPermitType(value: unknown): value is ForeignPermitType {
  return typeof value === "string" && FOREIGN_PERMIT_TYPES.includes(value as ForeignPermitType);
}
