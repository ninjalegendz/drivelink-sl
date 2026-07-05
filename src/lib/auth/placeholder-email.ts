// Supabase auth.users requires an email, even for phone-only signups.
// Phone-only renters get a synthetic address using the .invalid TLD
// (RFC 6761, guaranteed to never resolve, so accidental sends go nowhere).
// We never display this back to the user; it just satisfies Supabase auth.

import { digitsOnly } from "@/lib/auth/phone-format";

export function placeholderEmailFor(phone: string): string {
  const digits = digitsOnly(phone);
  return `${digits}@phone.drivelink.invalid`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith("@phone.drivelink.invalid"));
}
