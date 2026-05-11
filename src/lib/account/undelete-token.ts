import { createHmac, timingSafeEqual } from "crypto";

// 7-day window during which a soft-deleted account can be restored via
// the link in the confirmation email. After that, the deletion is
// effectively permanent (data is already scrubbed; only deleted_at +
// preserved stats remain).
export const UNDELETE_WINDOW_MS = 7 * 24 * 3600_000;

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY!;
}

/**
 * Token format: HMAC-SHA256 of "userId|deletedAtIso" signed with the
 * service-role key. Cannot be forged without that secret. Rotates on
 * each new deletion because deletedAt changes.
 */
export function generateUndeleteToken(userId: string, deletedAtIso: string): string {
  return createHmac("sha256", secret())
    .update(`undelete|${userId}|${deletedAtIso}`)
    .digest("hex");
}

export interface UndeleteVerifyResult {
  ok: boolean;
  reason?: "bad_token" | "expired" | "not_deleted";
}

export function verifyUndeleteToken(
  userId:        string,
  deletedAtIso:  string | null,
  candidate:     string
): UndeleteVerifyResult {
  if (!deletedAtIso) return { ok: false, reason: "not_deleted" };

  const elapsed = Date.now() - new Date(deletedAtIso).getTime();
  if (elapsed > UNDELETE_WINDOW_MS) return { ok: false, reason: "expired" };

  const expected = generateUndeleteToken(userId, deletedAtIso);
  const cand     = Buffer.from(candidate, "hex");
  const exp      = Buffer.from(expected, "hex");
  if (cand.length !== exp.length) return { ok: false, reason: "bad_token" };
  if (!timingSafeEqual(cand, exp)) return { ok: false, reason: "bad_token" };

  return { ok: true };
}
