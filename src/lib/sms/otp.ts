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
export const OTP_MAX_ATTEMPTS        = 5;

// Escalating resend cooldown: first send is free, second send needs a 60s
// gap, anything after needs 120s. Stops casual spammers but doesn't punish
// a renter who fat-fingered their phone and needs one quick resend.
export const OTP_FIRST_RESEND_MS  = 60_000;
export const OTP_REPEAT_RESEND_MS = 120_000;
// After 1 hour of no sends, the burst counter resets so a returning user
// gets the friendly 60s cooldown again instead of being stuck at 120s.
export const OTP_BURST_RESET_MS   = 60 * 60_000;

/**
 * Returns required wait time (ms) BEFORE allowing another send. Pass the
 * count of prior sends in the current burst.
 *
 * 0 prior sends → 0 (no wait)
 * 1 prior send  → 60s
 * 2+ prior      → 120s
 */
export function cooldownForSendCount(priorSends: number): number {
  if (priorSends <= 0) return 0;
  if (priorSends === 1) return OTP_FIRST_RESEND_MS;
  return OTP_REPEAT_RESEND_MS;
}

/**
 * Compute effective send count, accounting for the burst-reset window.
 * If the user has been idle longer than OTP_BURST_RESET_MS we treat them
 * as starting fresh.
 */
export function effectiveSendCount(
  storedCount: number,
  lastSentIso: string | null,
): number {
  if (!lastSentIso) return 0;
  const idle = Date.now() - new Date(lastSentIso).getTime();
  if (idle >= OTP_BURST_RESET_MS) return 0;
  return storedCount;
}
