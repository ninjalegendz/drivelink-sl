import type { SupabaseClient } from "@supabase/supabase-js";

// Staff/team access (PAGE-005). Operational API routes used to gate on
// `agencies.owner_id === user.id`. A page can now have staff (agency_members)
// who share the owner's operational surface, so those checks go through here:
// true if the user OWNS the agency or is an active staff member of it.
//
// Mirrors the SQL helper public.can_act_on_agency() that backs RLS. App-layer
// routes still need it because many of them run on the service client (which
// bypasses RLS) or short-circuit on an explicit owner comparison before any
// RLS-guarded write happens.
export async function canActOnAgency(
  client: SupabaseClient,
  userId: string,
  agencyId: string | null | undefined,
): Promise<boolean> {
  if (!userId || !agencyId) return false;

  const { data: owned } = await client
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return true;

  const { data: member } = await client
    .from("agency_members")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(member);
}

/**
 * The set of agency ids the user can operate: owned ∪ staff-member-of.
 * Mirrors SQL public.acting_agency_ids(). Handy when a route needs to filter
 * a query by "any of my pages" (e.g. the consent-gated document proxy).
 */
export async function getActingAgencyIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  if (!userId) return [];
  const [owned, mems] = await Promise.all([
    client.from("agencies").select("id").eq("owner_id", userId),
    client.from("agency_members").select("agency_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const r of owned.data ?? []) ids.add((r as { id: string }).id);
  for (const r of mems.data ?? []) ids.add((r as { agency_id: string }).agency_id);
  return [...ids];
}

/** True only if the user is the OWNER of the agency (structural actions). */
export async function isAgencyOwner(
  client: SupabaseClient,
  userId: string,
  agencyId: string | null | undefined,
): Promise<boolean> {
  if (!userId || !agencyId) return false;
  const { data } = await client
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}
