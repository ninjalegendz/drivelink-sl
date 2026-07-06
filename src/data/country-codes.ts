// Country dial codes for the phone input's country picker.
//
// Order matters for display AND for matchDialCode's first-match-wins tie
// break: Sri Lanka first (home market), then a "popular with DriveLink
// users" block, then the rest of the world alphabetically. Countries that
// share a dial code (e.g. the NANP "+1" countries) resolve to whichever one
// appears first in this array.

export interface CountryCode {
  iso:  string; // ISO 3166-1 alpha-2 (or common short code)
  name: string;
  dial: string; // digits only, no leading "+"
  flag: string; // emoji flag
}

export const COUNTRY_CODES: CountryCode[] = [
  // ── Home market ─────────────────────────────────────────────────────
  { iso: "LK", name: "Sri Lanka", dial: "94", flag: "🇱🇰" },

  // ── Popular with DriveLink users ────────────────────────────────────
  { iso: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { iso: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { iso: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { iso: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
  { iso: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { iso: "CH", name: "Switzerland", dial: "41", flag: "🇨🇭" },
  { iso: "RU", name: "Russia", dial: "7", flag: "🇷🇺" },
  { iso: "CN", name: "China", dial: "86", flag: "🇨🇳" },
  { iso: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso: "KR", name: "South Korea", dial: "82", flag: "🇰🇷" },
  { iso: "SG", name: "Singapore", dial: "65", flag: "🇸🇬" },
  { iso: "MY", name: "Malaysia", dial: "60", flag: "🇲🇾" },
  { iso: "TH", name: "Thailand", dial: "66", flag: "🇹🇭" },
  { iso: "AE", name: "UAE", dial: "971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "966", flag: "🇸🇦" },
  { iso: "QA", name: "Qatar", dial: "974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait", dial: "965", flag: "🇰🇼" },
  { iso: "OM", name: "Oman", dial: "968", flag: "🇴🇲" },
  { iso: "BH", name: "Bahrain", dial: "973", flag: "🇧🇭" },
  { iso: "IL", name: "Israel", dial: "972", flag: "🇮🇱" },
  { iso: "NZ", name: "New Zealand", dial: "64", flag: "🇳🇿" },
  { iso: "MV", name: "Maldives", dial: "960", flag: "🇲🇻" },
  { iso: "BD", name: "Bangladesh", dial: "880", flag: "🇧🇩" },
  { iso: "PK", name: "Pakistan", dial: "92", flag: "🇵🇰" },
  { iso: "NP", name: "Nepal", dial: "977", flag: "🇳🇵" },

  // ── Rest of the world (alphabetical) ────────────────────────────────
  { iso: "AF", name: "Afghanistan", dial: "93", flag: "🇦🇫" },
  { iso: "AL", name: "Albania", dial: "355", flag: "🇦🇱" },
  { iso: "DZ", name: "Algeria", dial: "213", flag: "🇩🇿" },
  { iso: "AD", name: "Andorra", dial: "376", flag: "🇦🇩" },
  { iso: "AO", name: "Angola", dial: "244", flag: "🇦🇴" },
  { iso: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { iso: "AM", name: "Armenia", dial: "374", flag: "🇦🇲" },
  { iso: "AT", name: "Austria", dial: "43", flag: "🇦🇹" },
  { iso: "AZ", name: "Azerbaijan", dial: "994", flag: "🇦🇿" },
  { iso: "BS", name: "Bahamas", dial: "1", flag: "🇧🇸" },
  { iso: "BB", name: "Barbados", dial: "1", flag: "🇧🇧" },
  { iso: "BY", name: "Belarus", dial: "375", flag: "🇧🇾" },
  { iso: "BE", name: "Belgium", dial: "32", flag: "🇧🇪" },
  { iso: "BZ", name: "Belize", dial: "501", flag: "🇧🇿" },
  { iso: "BJ", name: "Benin", dial: "229", flag: "🇧🇯" },
  { iso: "BT", name: "Bhutan", dial: "975", flag: "🇧🇹" },
  { iso: "BO", name: "Bolivia", dial: "591", flag: "🇧🇴" },
  { iso: "BA", name: "Bosnia and Herzegovina", dial: "387", flag: "🇧🇦" },
  { iso: "BW", name: "Botswana", dial: "267", flag: "🇧🇼" },
  { iso: "BR", name: "Brazil", dial: "55", flag: "🇧🇷" },
  { iso: "BN", name: "Brunei", dial: "673", flag: "🇧🇳" },
  { iso: "BG", name: "Bulgaria", dial: "359", flag: "🇧🇬" },
  { iso: "BF", name: "Burkina Faso", dial: "226", flag: "🇧🇫" },
  { iso: "BI", name: "Burundi", dial: "257", flag: "🇧🇮" },
  { iso: "KH", name: "Cambodia", dial: "855", flag: "🇰🇭" },
  { iso: "CM", name: "Cameroon", dial: "237", flag: "🇨🇲" },
  { iso: "CV", name: "Cape Verde", dial: "238", flag: "🇨🇻" },
  { iso: "TD", name: "Chad", dial: "235", flag: "🇹🇩" },
  { iso: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { iso: "CO", name: "Colombia", dial: "57", flag: "🇨🇴" },
  { iso: "CG", name: "Congo", dial: "242", flag: "🇨🇬" },
  { iso: "CR", name: "Costa Rica", dial: "506", flag: "🇨🇷" },
  { iso: "HR", name: "Croatia", dial: "385", flag: "🇭🇷" },
  { iso: "CU", name: "Cuba", dial: "53", flag: "🇨🇺" },
  { iso: "CY", name: "Cyprus", dial: "357", flag: "🇨🇾" },
  { iso: "CZ", name: "Czech Republic", dial: "420", flag: "🇨🇿" },
  { iso: "DK", name: "Denmark", dial: "45", flag: "🇩🇰" },
  { iso: "DJ", name: "Djibouti", dial: "253", flag: "🇩🇯" },
  { iso: "DO", name: "Dominican Republic", dial: "1", flag: "🇩🇴" },
  { iso: "CD", name: "DR Congo", dial: "243", flag: "🇨🇩" },
  { iso: "EC", name: "Ecuador", dial: "593", flag: "🇪🇨" },
  { iso: "EG", name: "Egypt", dial: "20", flag: "🇪🇬" },
  { iso: "SV", name: "El Salvador", dial: "503", flag: "🇸🇻" },
  { iso: "EE", name: "Estonia", dial: "372", flag: "🇪🇪" },
  { iso: "SZ", name: "Eswatini", dial: "268", flag: "🇸🇿" },
  { iso: "ET", name: "Ethiopia", dial: "251", flag: "🇪🇹" },
  { iso: "FJ", name: "Fiji", dial: "679", flag: "🇫🇯" },
  { iso: "FI", name: "Finland", dial: "358", flag: "🇫🇮" },
  { iso: "GA", name: "Gabon", dial: "241", flag: "🇬🇦" },
  { iso: "GM", name: "Gambia", dial: "220", flag: "🇬🇲" },
  { iso: "GE", name: "Georgia", dial: "995", flag: "🇬🇪" },
  { iso: "GH", name: "Ghana", dial: "233", flag: "🇬🇭" },
  { iso: "GR", name: "Greece", dial: "30", flag: "🇬🇷" },
  { iso: "GT", name: "Guatemala", dial: "502", flag: "🇬🇹" },
  { iso: "GN", name: "Guinea", dial: "224", flag: "🇬🇳" },
  { iso: "GY", name: "Guyana", dial: "592", flag: "🇬🇾" },
  { iso: "HT", name: "Haiti", dial: "509", flag: "🇭🇹" },
  { iso: "HN", name: "Honduras", dial: "504", flag: "🇭🇳" },
  { iso: "HK", name: "Hong Kong", dial: "852", flag: "🇭🇰" },
  { iso: "HU", name: "Hungary", dial: "36", flag: "🇭🇺" },
  { iso: "IS", name: "Iceland", dial: "354", flag: "🇮🇸" },
  { iso: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
  { iso: "IR", name: "Iran", dial: "98", flag: "🇮🇷" },
  { iso: "IQ", name: "Iraq", dial: "964", flag: "🇮🇶" },
  { iso: "IE", name: "Ireland", dial: "353", flag: "🇮🇪" },
  { iso: "CI", name: "Ivory Coast", dial: "225", flag: "🇨🇮" },
  { iso: "JM", name: "Jamaica", dial: "1", flag: "🇯🇲" },
  { iso: "JO", name: "Jordan", dial: "962", flag: "🇯🇴" },
  { iso: "KZ", name: "Kazakhstan", dial: "7", flag: "🇰🇿" },
  { iso: "KE", name: "Kenya", dial: "254", flag: "🇰🇪" },
  { iso: "KG", name: "Kyrgyzstan", dial: "996", flag: "🇰🇬" },
  { iso: "LA", name: "Laos", dial: "856", flag: "🇱🇦" },
  { iso: "LV", name: "Latvia", dial: "371", flag: "🇱🇻" },
  { iso: "LB", name: "Lebanon", dial: "961", flag: "🇱🇧" },
  { iso: "LS", name: "Lesotho", dial: "266", flag: "🇱🇸" },
  { iso: "LR", name: "Liberia", dial: "231", flag: "🇱🇷" },
  { iso: "LY", name: "Libya", dial: "218", flag: "🇱🇾" },
  { iso: "LI", name: "Liechtenstein", dial: "423", flag: "🇱🇮" },
  { iso: "LT", name: "Lithuania", dial: "370", flag: "🇱🇹" },
  { iso: "LU", name: "Luxembourg", dial: "352", flag: "🇱🇺" },
  { iso: "MO", name: "Macau", dial: "853", flag: "🇲🇴" },
  { iso: "MG", name: "Madagascar", dial: "261", flag: "🇲🇬" },
  { iso: "MW", name: "Malawi", dial: "265", flag: "🇲🇼" },
  { iso: "ML", name: "Mali", dial: "223", flag: "🇲🇱" },
  { iso: "MT", name: "Malta", dial: "356", flag: "🇲🇹" },
  { iso: "MR", name: "Mauritania", dial: "222", flag: "🇲🇷" },
  { iso: "MU", name: "Mauritius", dial: "230", flag: "🇲🇺" },
  { iso: "MX", name: "Mexico", dial: "52", flag: "🇲🇽" },
  { iso: "MD", name: "Moldova", dial: "373", flag: "🇲🇩" },
  { iso: "MC", name: "Monaco", dial: "377", flag: "🇲🇨" },
  { iso: "MN", name: "Mongolia", dial: "976", flag: "🇲🇳" },
  { iso: "ME", name: "Montenegro", dial: "382", flag: "🇲🇪" },
  { iso: "MA", name: "Morocco", dial: "212", flag: "🇲🇦" },
  { iso: "MZ", name: "Mozambique", dial: "258", flag: "🇲🇿" },
  { iso: "MM", name: "Myanmar", dial: "95", flag: "🇲🇲" },
  { iso: "NA", name: "Namibia", dial: "264", flag: "🇳🇦" },
  { iso: "NI", name: "Nicaragua", dial: "505", flag: "🇳🇮" },
  { iso: "NE", name: "Niger", dial: "227", flag: "🇳🇪" },
  { iso: "NG", name: "Nigeria", dial: "234", flag: "🇳🇬" },
  { iso: "KP", name: "North Korea", dial: "850", flag: "🇰🇵" },
  { iso: "MK", name: "North Macedonia", dial: "389", flag: "🇲🇰" },
  { iso: "NO", name: "Norway", dial: "47", flag: "🇳🇴" },
  { iso: "PA", name: "Panama", dial: "507", flag: "🇵🇦" },
  { iso: "PG", name: "Papua New Guinea", dial: "675", flag: "🇵🇬" },
  { iso: "PY", name: "Paraguay", dial: "595", flag: "🇵🇾" },
  { iso: "PE", name: "Peru", dial: "51", flag: "🇵🇪" },
  { iso: "PH", name: "Philippines", dial: "63", flag: "🇵🇭" },
  { iso: "PL", name: "Poland", dial: "48", flag: "🇵🇱" },
  { iso: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { iso: "PR", name: "Puerto Rico", dial: "1", flag: "🇵🇷" },
  { iso: "RO", name: "Romania", dial: "40", flag: "🇷🇴" },
  { iso: "RW", name: "Rwanda", dial: "250", flag: "🇷🇼" },
  { iso: "WS", name: "Samoa", dial: "685", flag: "🇼🇸" },
  { iso: "SM", name: "San Marino", dial: "378", flag: "🇸🇲" },
  { iso: "SN", name: "Senegal", dial: "221", flag: "🇸🇳" },
  { iso: "RS", name: "Serbia", dial: "381", flag: "🇷🇸" },
  { iso: "SC", name: "Seychelles", dial: "248", flag: "🇸🇨" },
  { iso: "SL", name: "Sierra Leone", dial: "232", flag: "🇸🇱" },
  { iso: "SK", name: "Slovakia", dial: "421", flag: "🇸🇰" },
  { iso: "SI", name: "Slovenia", dial: "386", flag: "🇸🇮" },
  { iso: "SO", name: "Somalia", dial: "252", flag: "🇸🇴" },
  { iso: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦" },
  { iso: "SS", name: "South Sudan", dial: "211", flag: "🇸🇸" },
  { iso: "SD", name: "Sudan", dial: "249", flag: "🇸🇩" },
  { iso: "SR", name: "Suriname", dial: "597", flag: "🇸🇷" },
  { iso: "SE", name: "Sweden", dial: "46", flag: "🇸🇪" },
  { iso: "SY", name: "Syria", dial: "963", flag: "🇸🇾" },
  { iso: "TW", name: "Taiwan", dial: "886", flag: "🇹🇼" },
  { iso: "TJ", name: "Tajikistan", dial: "992", flag: "🇹🇯" },
  { iso: "TZ", name: "Tanzania", dial: "255", flag: "🇹🇿" },
  { iso: "TL", name: "Timor-Leste", dial: "670", flag: "🇹🇱" },
  { iso: "TG", name: "Togo", dial: "228", flag: "🇹🇬" },
  { iso: "TO", name: "Tonga", dial: "676", flag: "🇹🇴" },
  { iso: "TT", name: "Trinidad and Tobago", dial: "1", flag: "🇹🇹" },
  { iso: "TN", name: "Tunisia", dial: "216", flag: "🇹🇳" },
  { iso: "TR", name: "Turkey", dial: "90", flag: "🇹🇷" },
  { iso: "TM", name: "Turkmenistan", dial: "993", flag: "🇹🇲" },
  { iso: "UG", name: "Uganda", dial: "256", flag: "🇺🇬" },
  { iso: "UA", name: "Ukraine", dial: "380", flag: "🇺🇦" },
  { iso: "UY", name: "Uruguay", dial: "598", flag: "🇺🇾" },
  { iso: "UZ", name: "Uzbekistan", dial: "998", flag: "🇺🇿" },
  { iso: "VU", name: "Vanuatu", dial: "678", flag: "🇻🇺" },
  { iso: "VA", name: "Vatican City", dial: "379", flag: "🇻🇦" },
  { iso: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪" },
  { iso: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { iso: "YE", name: "Yemen", dial: "967", flag: "🇾🇪" },
  { iso: "ZM", name: "Zambia", dial: "260", flag: "🇿🇲" },
  { iso: "ZW", name: "Zimbabwe", dial: "263", flag: "🇿🇼" },
];

/**
 * Longest-prefix match of a "+…" number against the dial codes above.
 * Ties (same-length prefix shared by multiple countries, e.g. the NANP "+1"
 * block) resolve to whichever entry appears first in COUNTRY_CODES, i.e.
 * the pinned ordering above decides (so "+1416…" → United States, since US
 * is listed before Canada).
 */
export function matchDialCode(e164: string): CountryCode | null {
  const digits = (e164 ?? "").replace(/\D/g, "");
  if (!digits) return null;

  let best: CountryCode | null = null;
  for (const country of COUNTRY_CODES) {
    if (digits.startsWith(country.dial) && (!best || country.dial.length > best.dial.length)) {
      best = country;
    }
  }
  return best;
}

// ── Per-country number rules (example + validation) ───────────────────
//
// `example` is the NATIONAL number (no dial code) shown as the field's
// placeholder. `min`/`max` bound the national significant digit count.
// `startsWith` (optional) lists the allowed leading digit(s) — used for
// Sri Lanka, whose mobiles are all 07X locally (national 7XXXXXXXX).
//
// We keep ACCURATE rules for the home market + the countries DriveLink
// users actually come from, and fall back to a permissive E.164 range
// (6–14 national digits) everywhere else, so a real number from a country
// we haven't tabulated is never wrongly rejected.
export interface PhoneRule {
  example:     string;
  min:         number;
  max:         number;
  startsWith?: string[];
}

const GENERIC_RULE: PhoneRule = { example: "", min: 6, max: 14 };

const PHONE_RULES: Record<string, PhoneRule> = {
  LK: { example: "771234567",  min: 9,  max: 9,  startsWith: ["7"] }, // all SL mobiles are 07X
  IN: { example: "9812345678", min: 10, max: 10, startsWith: ["6", "7", "8", "9"] },
  GB: { example: "7911123456", min: 10, max: 10, startsWith: ["7"] },
  AU: { example: "412345678",  min: 9,  max: 9,  startsWith: ["4"] },
  US: { example: "2015550123", min: 10, max: 10 },
  CA: { example: "4165550123", min: 10, max: 10 },
  DE: { example: "15123456789", min: 10, max: 11 },
  FR: { example: "612345678",  min: 9,  max: 9 },
  NL: { example: "612345678",  min: 9,  max: 9 },
  IT: { example: "3123456789", min: 9,  max: 10 },
  ES: { example: "612345678",  min: 9,  max: 9 },
  CH: { example: "781234567",  min: 9,  max: 9 },
  RU: { example: "9123456789", min: 10, max: 10 },
  CN: { example: "13123456789", min: 11, max: 11, startsWith: ["1"] },
  JP: { example: "9012345678", min: 10, max: 10 },
  KR: { example: "1023456789", min: 9,  max: 10 },
  SG: { example: "81234567",   min: 8,  max: 8,  startsWith: ["8", "9"] },
  MY: { example: "123456789",  min: 9,  max: 10 },
  TH: { example: "812345678",  min: 9,  max: 9 },
  AE: { example: "501234567",  min: 9,  max: 9,  startsWith: ["5"] },
  SA: { example: "512345678",  min: 9,  max: 9,  startsWith: ["5"] },
  QA: { example: "33123456",   min: 8,  max: 8 },
  KW: { example: "50123456",   min: 8,  max: 8 },
  OM: { example: "92123456",   min: 8,  max: 8 },
  BH: { example: "36001234",   min: 8,  max: 8 },
  IL: { example: "502345678",  min: 9,  max: 9 },
  NZ: { example: "211234567",  min: 8,  max: 10 },
  MV: { example: "7712345",    min: 7,  max: 7 },
  BD: { example: "1812345678", min: 10, max: 10, startsWith: ["1"] },
  PK: { example: "3012345678", min: 10, max: 10, startsWith: ["3"] },
  NP: { example: "9812345678", min: 10, max: 10 },
};

/** The number rule for a country ISO, with a permissive generic fallback. */
export function phoneRuleFor(iso: string): PhoneRule {
  return PHONE_RULES[iso] ?? GENERIC_RULE;
}

/** True when a national number fits the country's format. Empty → false. */
export function isValidNationalNumber(iso: string, national: string): boolean {
  const digits = (national ?? "").replace(/\D/g, "");
  if (!digits) return false;
  const rule = phoneRuleFor(iso);
  if (digits.length < rule.min || digits.length > rule.max) return false;
  if (rule.startsWith && !rule.startsWith.some((p) => digits.startsWith(p))) return false;
  return true;
}

/**
 * Validate a full E.164 number against its country's format. Used by the
 * PhoneInput and form submit gates to reject wrong-format numbers before
 * an OTP is ever sent.
 */
export function isValidInternationalPhone(e164: string): boolean {
  const country = matchDialCode(e164);
  if (!country) return false;
  const national = (e164 ?? "").replace(/\D/g, "").slice(country.dial.length);
  return isValidNationalNumber(country.iso, national);
}
