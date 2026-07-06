// Shared incident/dispute type vocabulary, used by the renter- and page-side
// "Report a problem" form and by the admin dispute-review panel so labels
// stay in sync with the DB enum and with /api/bookings/[id]/dispute.
//
// Wording note: "page" is the DriveLink term for what a renter would call
// the agency/host's listing page, never say "agency" in visible copy.

export type IncidentType =
  | "accident"
  | "breakdown"
  | "late_return"
  | "no_show"
  | "damage_claim"
  | "fine_received"
  | "toll_claim"
  | "lost_item"
  | "driver_complaint"
  | "conduct_violation"
  | "vehicle_mismatch"
  | "deposit_violation"
  | "other";

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  accident:           "Accident",
  breakdown:          "Breakdown / mechanical problem",
  late_return:        "Late return / not returned",
  no_show:            "Renter no-show",
  damage_claim:       "Damage to the vehicle",
  fine_received:      "Traffic fine received",
  toll_claim:         "Toll / expressway charge",
  lost_item:          "Lost item / accessory missing",
  driver_complaint:   "Driver conduct",
  conduct_violation:  "Renter conduct",
  vehicle_mismatch:   "Vehicle not as listed",
  deposit_violation:  "Deposit problem",
  other:              "Something else",
};

/** Options shown to the renter, in display order. */
export const RENTER_INCIDENT_TYPES: IncidentType[] = [
  "vehicle_mismatch",
  "breakdown",
  "accident",
  "deposit_violation",
  "driver_complaint",
  "other",
];

/** Options shown to the page (host/agency) side, in display order. */
export const PAGE_INCIDENT_TYPES: IncidentType[] = [
  "damage_claim",
  "late_return",
  "no_show",
  "fine_received",
  "toll_claim",
  "lost_item",
  "conduct_violation",
  "other",
];

/** Types where an "amount involved" figure is meaningful. */
export const MONEY_INCIDENT_TYPES: ReadonlySet<IncidentType> = new Set([
  "damage_claim",
  "fine_received",
  "toll_claim",
  "lost_item",
  "deposit_violation",
]);

export const INCIDENT_SIDE_LABELS: Record<string, string> = {
  renter: "Renter",
  page:   "Rental Page",
  admin:  "DriveLink team",
};
