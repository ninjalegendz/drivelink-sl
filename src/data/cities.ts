// The 25 administrative districts of Sri Lanka (alphabetical). Used as the
// area/location picker across the marketplace filter, agency signup and the
// vehicle forms. (Kept the export name SL_CITIES so all the importers keep
// working; SL_DISTRICTS is a clearer alias.)
export const SL_CITIES = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
] as const;

/** Clearer alias for the same list. */
export const SL_DISTRICTS = SL_CITIES;

export type SLCity = (typeof SL_CITIES)[number];

export const POPULAR_CITIES = [
  "Colombo",
  "Kandy",
  "Galle",
  "Gampaha",
  "Nuwara Eliya",
  "Matara",
] as const;
