// Shared pickup/return inspection vocabulary (migration 051's
// `booking_inspections` table). Used by the submit + ack API routes and by
// InspectionFlow so labels and validation stay in sync with the DB check
// constraints. Mirrors the incident-types.ts pattern.

export type InspectionPhase = "pickup" | "return";

export type FuelLevel = "empty" | "quarter" | "half" | "three_quarter" | "full";

export const FUEL_LEVELS: FuelLevel[] = ["empty", "quarter", "half", "three_quarter", "full"];

export const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  empty:         "Empty",
  quarter:       "1/4",
  half:          "1/2",
  three_quarter: "3/4",
  full:          "Full",
};

export type DepositMethod = "cash" | "bank_transfer" | "other";

export const DEPOSIT_METHODS: DepositMethod[] = ["cash", "bank_transfer", "other"];

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  cash:          "Cash",
  bank_transfer: "Bank transfer",
  other:         "Other",
};

/**
 * Named photo slots shown in the pickup/return uploader. Any photos beyond
 * these fixed slots are freeform "add more" extras, still counted toward
 * the minimum.
 */
export const INSPECTION_PHOTO_SLOTS = [
  "Front", "Rear", "Left", "Right", "Dashboard", "Odometer", "Fuel gauge", "Interior",
] as const;

export const MIN_INSPECTION_PHOTOS = 4;

export interface InspectionChecklist {
  documents_present?: boolean;
  accessories?:       string[];
  notes?:             string;
}

export interface InspectionRow {
  id:                  string;
  booking_id:          string;
  phase:               InspectionPhase;
  submitted_by:        string;
  odometer_km:         number | null;
  fuel_level:          FuelLevel | null;
  plate_confirmed:     boolean;
  checklist:           InspectionChecklist | null;
  photo_urls:          string[];
  video_url:           string | null;
  notes:               string | null;
  renter_ack_at:       string | null;
  renter_dispute_note: string | null;
  created_at:          string;
  updated_at:          string;
}

// Kept as a plain string constant (not a "use client" export) so both
// server-side queries (the renter page, the agency bookings query) and the
// API routes' post-write `.select()` share the exact same column list.
export const INSPECTIONS_SELECT =
  "id, booking_id, phase, submitted_by, odometer_km, fuel_level, plate_confirmed, checklist, " +
  "photo_urls, video_url, notes, renter_ack_at, renter_dispute_note, created_at, updated_at";
