// Sri Lankan phone number helpers.
// We store and accept input in local format (077XXXXXXX) so it matches the
// way Sri Lankans actually write and remember their numbers. Internally we
// convert to E.164 (+94...) before sending to text.lk, since their API
// expects the country code.

const SL_LOCAL_LENGTH         = 10;        // 0 + 9 digits, e.g. 0779666800
const SL_NATIONAL_LENGTH      = 9;         // without leading 0
const SL_INTL_LENGTH          = 11;        // 94 + 9 digits

/** Strip everything except digits. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Convert any common SL phone form to E.164 (`+94XXXXXXXXX`). Returns null
 * when the digit count doesn't match a Sri Lankan mobile number.
 */
export function toInternationalSL(input: string): string | null {
  const d = digitsOnly(input);

  if (d.length === SL_LOCAL_LENGTH && d.startsWith("0"))   return `+94${d.slice(1)}`;
  if (d.length === SL_INTL_LENGTH  && d.startsWith("94"))  return `+${d}`;
  if (d.length === SL_NATIONAL_LENGTH)                     return `+94${d}`;

  return null;
}

/**
 * Convert any common SL phone form to local (`0XXXXXXXXX`). Returns null on
 * unparseable input. Used when displaying numbers back to renters/agencies.
 */
export function toLocalSL(input: string): string | null {
  const d = digitsOnly(input);

  if (d.length === SL_LOCAL_LENGTH && d.startsWith("0"))   return d;
  if (d.length === SL_INTL_LENGTH  && d.startsWith("94"))  return `0${d.slice(2)}`;
  if (d.length === SL_NATIONAL_LENGTH)                     return `0${d}`;

  return null;
}

export function isValidSLPhone(input: string): boolean {
  return toInternationalSL(input) !== null;
}
