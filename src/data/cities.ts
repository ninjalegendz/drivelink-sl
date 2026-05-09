export const SL_CITIES = [
  "Colombo",
  "Gampaha",
  "Kandy",
  "Galle",
  "Negombo",
  "Matara",
  "Jaffna",
  "Kurunegala",
  "Anuradhapura",
  "Ella",
  "Nuwara Eliya",
  "Trincomalee",
  "Batticaloa",
  "Ratnapura",
  "Badulla",
  "Katunayake",
  "Nugegoda",
  "Dehiwala",
  "Moratuwa",
  "Kelaniya",
] as const;

export type SLCity = (typeof SL_CITIES)[number];

export const POPULAR_CITIES = [
  "Colombo",
  "Kandy",
  "Galle",
  "Negombo",
  "Ella",
  "Nuwara Eliya",
] as const;
