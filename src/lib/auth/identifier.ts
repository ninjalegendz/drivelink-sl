import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164 } from "@/lib/auth/phone-format";

// Prefer the one canonical E.164 number. Keep an exact raw fallback only for
// an older local-format record; never use a suffix, which can collide across
// countries (for example, Sri Lankan and UK numbers with the same ending).
export function phoneLookupCandidates(input: string): string[] {
  const raw = input.trim();
  const canonical = toE164(raw);
  if (!canonical) return [];
  return [...new Set([canonical, raw])];
}

export function isEmailLike(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export interface ResolvedIdentity {
  userId:        string;
  email:         string | null;
  phone:         string;
  emailVerified: boolean;
  channel:       "email" | "phone";
}

/**
 * Look up a user by either email (auth.users.email) or a full normalised
 * phone number. Service-role client required.
 *
 * Returns null when the identifier doesn't resolve, caller should still
 * present a generic success message to avoid leaking account existence.
 */
export async function resolveIdentifier(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  identifier: string
): Promise<ResolvedIdentity | null> {
  const trimmed = identifier.trim();

  if (isEmailLike(trimmed)) {
    const lower = trimmed.toLowerCase();
    // Soft-deleted users have their auth email scrambled to deleted+...@drivelink.invalid
    // and their profiles.email set to null, both paths return null below.
    if (lower.endsWith("@drivelink.invalid")) return null;

    // Walk listUsers pages, admin API doesn't expose a direct email lookup.
    // Most installs are well under 1000 users, so a single page is enough.
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error || !data?.users) return null;
    const user = data.users.find((u) => (u.email ?? "").toLowerCase() === lower);
    if (!user) return null;

    const { data: profile } = await service
      .from("profiles")
      .select("phone, deleted_at")
      .eq("id", user.id)
      .single();
    const p = profile as { phone?: string; deleted_at?: string | null } | null;
    if (p?.deleted_at) return null; // account is deleted, pretend it doesn't exist
    const phone = p?.phone ?? "";

    return {
      userId:        user.id,
      email:         user.email ?? null,
      phone,
      emailVerified: Boolean(user.email_confirmed_at),
      channel:       "email",
    };
  }

  // Phone path
  const candidates = phoneLookupCandidates(trimmed);
  if (candidates.length === 0) return null;

  const { data: profiles } = await service
    .from("profiles")
    .select("id, phone")
    .in("phone", candidates)
    .is("deleted_at", null);

  const matches = (profiles ?? []) as { id: string; phone: string }[];
  if (matches.length !== 1) return null; // 0 or ambiguous → bail

  const { data: authData } = await service.auth.admin.getUserById(matches[0].id);
  const authUser = authData?.user;

  return {
    userId:        matches[0].id,
    email:         authUser?.email ?? null,
    phone:         matches[0].phone,
    emailVerified: Boolean(authUser?.email_confirmed_at),
    channel:       "phone",
  };
}
