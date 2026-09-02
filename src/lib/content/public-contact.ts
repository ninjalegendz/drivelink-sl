const CONTACT_PATTERNS = [
  /(?:https?:\/\/|www\.|wa\.me\/|whatsapp\.com\/)/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:^|\D)\+?\d(?:[\s().-]*\d){8,}(?:\D|$)/,
  /(?:facebook|instagram|telegram|tiktok)\s*[:/@][a-z0-9._-]+/i,
];

export const PUBLIC_CONTACT_ERROR =
  "Remove phone numbers, email addresses, web links, and social handles from public text. Contact details unlock through the booking.";

export function containsPublicContactDetails(...values: Array<string | null | undefined>): boolean {
  return CONTACT_PATTERNS.some((pattern) => values.some((value) => Boolean(value && pattern.test(value))));
}
