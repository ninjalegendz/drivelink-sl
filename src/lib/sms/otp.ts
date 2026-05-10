import { createHash, randomInt, timingSafeEqual } from "crypto";

// 6-digit numeric OTP. Cryptographically random so they're not predictable.
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// SHA-256 of code + the user's id — short-lived enough that bcrypt's slowness
// isn't worth the dependency. The user_id salt prevents cross-user lookups
// from being equivalent.
export function hashOtp(code: string, userId: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

export function compareOtp(code: string, userId: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(code, userId), "hex");
  const expected  = Buffer.from(storedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export const OTP_TTL_MS              = 10 * 60_000; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS  = 60_000;      // 1 minute between sends
export const OTP_MAX_ATTEMPTS        = 5;
