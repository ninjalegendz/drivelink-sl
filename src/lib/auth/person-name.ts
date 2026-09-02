// The name on a DriveLink account is cross-checked against the identity
// document during Didit verification, so a wrong value here surfaces later as
// a FULL_NAME_MISMATCH_WITH_PROVIDED warning and a manual review.
//
// This has already happened in production: an account was created with the
// NIC number typed into the name field, Didit read "Nawaratne Thirindu
// Kaveesha" from the card, flagged the mismatch, and the session needed a
// human decision. Catching it at signup costs one regex and saves a review.

/** Sri Lankan NIC: 9 digits with a V/X suffix, or the newer 12-digit form. */
const LOOKS_LIKE_NIC = /^\s*(\d{9}\s*[VXvx]|\d{12})\s*$/;

/** Any value that is only digits, spaces and punctuation is not a name. */
const HAS_NO_LETTERS = /^[^\p{L}]+$/u;

export type NameProblem = "too_short" | "looks_like_nic" | "no_letters";

export function checkPersonName(value: string): NameProblem | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return "too_short";
  if (LOOKS_LIKE_NIC.test(trimmed)) return "looks_like_nic";
  if (HAS_NO_LETTERS.test(trimmed)) return "no_letters";
  return null;
}

export const NAME_PROBLEM_MESSAGE: Record<NameProblem, string> = {
  too_short: "Enter your full name.",
  looks_like_nic:
    "That looks like your NIC number. Enter your name exactly as it appears on your ID, so identity verification matches.",
  no_letters:
    "Enter your name as it appears on your ID, not a number.",
};
