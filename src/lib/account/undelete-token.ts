// Undelete-token signing, Web Crypto only (works on Node + Workers).
//
// The functions are async because Web Crypto's HMAC API is async. Update
// callers to `await generateUndeleteToken` / `await verifyUndeleteToken`.

export const UNDELETE_WINDOW_MS = 7 * 24 * 3600_000;

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing, required for undelete-token signing");
  return s;
}

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

/**
 * Token format: HMAC-SHA256 of "undelete|userId|deletedAtIso" signed with
 * the service-role key. Cannot be forged without that secret. Rotates on
 * each new deletion because deletedAt changes.
 */
export async function generateUndeleteToken(userId: string, deletedAtIso: string): Promise<string> {
  const key  = await getKey();
  const data = new TextEncoder().encode(`undelete|${userId}|${deletedAtIso}`);
  const sig  = await crypto.subtle.sign("HMAC", key, data);
  return bytesToHex(new Uint8Array(sig));
}

export interface UndeleteVerifyResult {
  ok: boolean;
  reason?: "bad_token" | "expired" | "not_deleted";
}

export async function verifyUndeleteToken(
  userId:        string,
  deletedAtIso:  string | null,
  candidate:     string
): Promise<UndeleteVerifyResult> {
  if (!deletedAtIso) return { ok: false, reason: "not_deleted" };

  const elapsed = Date.now() - new Date(deletedAtIso).getTime();
  if (elapsed > UNDELETE_WINDOW_MS) return { ok: false, reason: "expired" };

  const expected = await generateUndeleteToken(userId, deletedAtIso);
  if (candidate.length !== expected.length) return { ok: false, reason: "bad_token" };
  if (!timingSafeEqualHex(candidate, expected)) return { ok: false, reason: "bad_token" };

  return { ok: true };
}

// ─── helpers ────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
