// Phone number helpers.
//
// Sri Lankan users can type their number the way they remember it (077XXXXXXX)
// and we default it to +94. Foreign users (tourists are a core audience) type
// their number WITH a country code (e.g. +44 7911 123456) and we keep it as
// E.164. Everything is stored in E.164 (+<country><number>) so text.lk /
// WhatsApp get a valid international destination.

const SL_LOCAL_LENGTH    = 10; // 0 + 9 digits, e.g. 0771234567
const SL_NATIONAL_LENGTH = 9;  // without leading 0
const SL_INTL_LENGTH      = 11; // 94 + 9 digits

/** Strip everything except digits. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normalise any reasonable phone input to E.164 (`+<country><number>`).
 *   - Starts with "+"  → treated as already-international (any country); we just
 *     validate the digit count (8–15, per E.164).
 *   - No "+"           → assumed Sri Lankan local/national and defaulted to +94.
 * Returns null when it can't be parsed into a plausible number.
 *
 * (Name kept for backwards-compatibility; it now handles all countries.)
 */
export function toInternationalSL(input: string): string | null {
  const trimmed = (input ?? "").trim();

  // Already-international: "+<country><number>".
  if (trimmed.startsWith("+")) {
    const d = digitsOnly(trimmed);
    return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  }

  // Bare input → assume Sri Lankan (the local default).
  const d = digitsOnly(trimmed);
  if (d.length === SL_LOCAL_LENGTH && d.startsWith("0"))  return `+94${d.slice(1)}`;
  if (d.length === SL_INTL_LENGTH  && d.startsWith("94")) return `+${d}`;
  if (d.length === SL_NATIONAL_LENGTH)                    return `+94${d}`;

  return null;
}

/** Preferred (country-agnostic) name for the same normaliser. */
export const toE164 = toInternationalSL;

/**
 * Convert a Sri Lankan number to local display form (`0XXXXXXXXX`). Returns null
 * for non-SL numbers, callers fall back to showing the raw E.164.
 */
export function toLocalSL(input: string): string | null {
  const d = digitsOnly(input);
  if (d.length === SL_LOCAL_LENGTH && d.startsWith("0"))  return d;
  if (d.length === SL_INTL_LENGTH  && d.startsWith("94")) return `0${d.slice(2)}`;
  if (d.length === SL_NATIONAL_LENGTH)                    return `0${d}`;
  return null;
}

/** True for any phone we can normalise to E.164 (SL local or +country). */
export function isValidSLPhone(input: string): boolean {
  return toInternationalSL(input) !== null;
}

/** Preferred (country-agnostic) name for the same validity check. */
export const isValidPhone = isValidSLPhone;
