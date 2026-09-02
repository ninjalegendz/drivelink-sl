import type { SupabaseClient } from "@supabase/supabase-js";

export const STAFF_ROLES = ["manager", "booking_agent", "handover_agent", "fleet_editor", "support_agent"] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const STAFF_ROLE_DETAILS: Record<StaffRole, { label: string; description: string }> = {
  manager:        { label: "Manager", description: "Runs the page day to day: answers requests, closes rentals, edits the fleet and handles support." },
  booking_agent:  { label: "Booking agent", description: "Answers booking requests and messages renters. Cannot edit the fleet or close a rental." },
  handover_agent: { label: "Handover agent", description: "Messages renters and marks a rental finished once the vehicle is back." },
  fleet_editor:   { label: "Fleet editor", description: "Adds and updates vehicles, documents and availability only." },
  support_agent:  { label: "Support agent", description: "Replies to renter and DriveLink support messages. Cannot change bookings." },
};

export const PAGE_CAPABILITIES = [
  "view_page", "view_bookings", "manage_booking", "communicate", "manage_handover",
  "manage_financial", "manage_cases", "manage_fleet", "view_analytics", "manage_support",
  "manage_page", "view_documents", "declare_listing_authority",
] as const;
export type PageCapability = typeof PAGE_CAPABILITIES[number];

const ROLE_CAPABILITIES: Record<StaffRole, readonly PageCapability[]> = {
  manager:        PAGE_CAPABILITIES,
  booking_agent:  ["view_page", "view_bookings", "manage_booking", "communicate", "view_documents"],
  handover_agent: ["view_page", "view_bookings", "communicate", "manage_handover", "view_documents"],
  fleet_editor:   ["view_page", "manage_fleet"],
  support_agent:  ["view_page", "view_bookings", "communicate", "manage_support"],
};

export interface PageAccess {
  isOwner: boolean;
  role: "owner" | StaffRole | null;
  capabilities: readonly PageCapability[];
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

export function roleHasCapability(role: StaffRole, capability: PageCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

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
 * Checks a specific operational permission. `canActOnAgency` remains useful
 * for harmless page switching; any write or sensitive read should use this
 * capability gate instead. Page owners always retain the complete surface.
 */
export async function canPerformPageAction(
  client: SupabaseClient,
  userId: string,
  agencyId: string | null | undefined,
  capability: PageCapability,
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
    .select("role")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (member as { role?: unknown } | null)?.role;
  return isStaffRole(role) && roleHasCapability(role, capability);
}

export async function canPerformAnyPageAction(
  client: SupabaseClient,
  userId: string,
  agencyId: string | null | undefined,
  capabilities: readonly PageCapability[],
): Promise<boolean> {
  for (const capability of capabilities) {
    if (await canPerformPageAction(client, userId, agencyId, capability)) return true;
  }
  return false;
}

export async function getPageAccess(
  client: SupabaseClient,
  userId: string,
  agencyId: string | null | undefined,
): Promise<PageAccess> {
  if (!userId || !agencyId) return { isOwner: false, role: null, capabilities: [] };
  const { data: owned } = await client.from("agencies").select("id").eq("id", agencyId).eq("owner_id", userId).maybeSingle();
  if (owned) return { isOwner: true, role: "owner", capabilities: PAGE_CAPABILITIES };

  const { data: member } = await client.from("agency_members").select("role").eq("agency_id", agencyId).eq("user_id", userId).maybeSingle();
  const role = (member as { role?: unknown } | null)?.role;
  if (!isStaffRole(role)) return { isOwner: false, role: null, capabilities: [] };
  return { isOwner: false, role, capabilities: ROLE_CAPABILITIES[role] };
}

export interface AgencyDocumentAccess {
  allowed: boolean;
  role: "owner" | StaffRole | null;
  isOwner: boolean;
}

/**
 * Identity documents are intentionally narrower than general page access.
 * Owners always have access. Staff need the explicit privacy permission that
 * the owner controls in Page settings; a manager membership alone is not enough.
 */
export async function getAgencyDocumentAccess(
  client: SupabaseClient,
  userId: string,
  agencyId: string | null | undefined,
): Promise<AgencyDocumentAccess> {
  if (!userId || !agencyId) return { allowed: false, role: null, isOwner: false };

  const { data: pageRow } = await client
    .from("agencies")
    .select("owner_id, is_verified, is_blocked, deleted_at, owner:profiles!owner_id(kyc_status, is_blacklisted, deleted_at)")
    .eq("id", agencyId)
    .maybeSingle();
  const page = pageRow as {
    owner_id: string;
    is_verified: boolean;
    is_blocked: boolean;
    deleted_at: string | null;
    owner: { kyc_status: string; is_blacklisted: boolean; deleted_at: string | null } | null;
  } | null;

  // Suspension is a privacy boundary, not merely a marketplace label. A
  // blocked, deleted, or unverified page must immediately lose access to
  // renter identity files even when an earlier booking still has consent.
  const ownerEligible = page?.owner?.kyc_status === "verified"
    && page.owner.is_blacklisted !== true
    && !page.owner.deleted_at;
  if (!page || !page.is_verified || page.is_blocked || page.deleted_at || !ownerEligible) {
    return { allowed: false, role: null, isOwner: page?.owner_id === userId };
  }
  if (page.owner_id === userId) return { allowed: true, role: "owner", isOwner: true };

  const { data: member } = await client
    .from("agency_members")
    .select("role, can_view_renter_documents")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();

  const row = member as { role: unknown; can_view_renter_documents: boolean } | null;
  const role = isStaffRole(row?.role) ? row.role : null;
  return {
    allowed: row?.can_view_renter_documents === true && role !== null && roleHasCapability(role, "view_documents"),
    role,
    isOwner: false,
  };
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
