// OTP helpers, Web Crypto only (no node:crypto) so this runs in both
// Node (Vercel) and the Cloudflare Workers runtime we're migrating to.
//
// generateOtp/hashOtp/compareOtp are async because Web Crypto's digest
// API is async. Callers await them; nothing else changes contract-wise.

// 6-digit numeric OTP. Cryptographically random via Web Crypto and using
// rejection sampling so the distribution stays uniform (a naive modulo
// from a 32-bit random would bias the lowest few buckets).
export function generateOtp(): string {
  const limit = 1_000_000;
  // Largest multiple of `limit` that fits in 2^32; values above this we
  // reject and resample to keep the distribution flat.
  const cutoff = Math.floor(0xffffffff / limit) * limit;
  const buf = new Uint32Array(1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < cutoff) {
      return (buf[0] % limit).toString().padStart(6, "0");
    }
  }
}

// SHA-256 of code + the user's id, hex-encoded. The user_id acts as a
// per-row salt so identical OTP codes for different users hash differently.
export async function hashOtp(code: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${code}`);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

export async function compareOtp(code: string, userId: string, storedHash: string): Promise<boolean> {
  const candidate = await hashOtp(code, userId);
  return timingSafeEqualHex(candidate, storedHash);
}

// ─── helpers ────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Constant-time comparison of two hex strings. Returns false fast if
// lengths differ (length itself isn't a secret); past that, XOR every
// char so total time is proportional to length, not to where they diverge.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── constants & policy ─────────────────────────────────────────────

export const OTP_TTL_MS              = 10 * 60_000; // 10 minutes
export const OTP_MAX_ATTEMPTS        = 5;

export const OTP_FIRST_RESEND_MS  = 60_000;
export const OTP_REPEAT_RESEND_MS = 120_000;
export const OTP_BURST_RESET_MS   = 60 * 60_000;

export function cooldownForSendCount(priorSends: number): number {
  if (priorSends <= 0) return 0;
  if (priorSends === 1) return OTP_FIRST_RESEND_MS;
  return OTP_REPEAT_RESEND_MS;
}

export function effectiveSendCount(
  storedCount: number,
  lastSentIso: string | null,
): number {
  if (!lastSentIso) return 0;
  const idle = Date.now() - new Date(lastSentIso).getTime();
  if (idle >= OTP_BURST_RESET_MS) return 0;
  return storedCount;
}
