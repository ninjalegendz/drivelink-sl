import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Why a Rental Page is not visible to renters.
 *
 * `rental_page_is_public()` in the database is the real gate, and it is a
 * single boolean. That is fine for querying and useless for telling an owner
 * what to do, which is how a page could sit invisible with a fully approved
 * vehicle on it and nothing on any screen saying so. This resolves the same
 * conditions into the one thing the owner should fix next.
 */
export type LivenessBlocker =
  | "owner_unverified"
  | "phone_unverified"
  | "awaiting_business_review"
  | "deactivated"
  | "blocked";

export interface PageLiveness {
  live: boolean;
  blocker: LivenessBlocker | null;
}

interface LivenessInput {
  id: string;
  page_type: "personal" | "business";
  is_verified: boolean;
  is_blocked: boolean;
  deleted_at: string | null;
  deactivated_at: string | null;
  whatsapp_number: string | null;
  whatsapp_verified_at: string | null;
}

/**
 * Ordered by what the owner should deal with first. Blocked and deactivated
 * come before the rest because nothing else matters until they are resolved,
 * and identity comes before the page's own number because it gates more.
 */
export function pageLiveness(page: LivenessInput, ownerKycVerified: boolean): PageLiveness {
  if (page.is_blocked) return { live: false, blocker: "blocked" };
  if (page.deactivated_at || page.deleted_at) return { live: false, blocker: "deactivated" };
  if (!ownerKycVerified) return { live: false, blocker: "owner_unverified" };
  if (!page.whatsapp_number || !page.whatsapp_verified_at) return { live: false, blocker: "phone_unverified" };
  // Personal pages are auto-approved at creation; business pages wait on an
  // admin reading the registration certificate.
  if (!page.is_verified) return { live: false, blocker: "awaiting_business_review" };
  return { live: true, blocker: null };
}

/** Reads the two rows the check needs. Returns null when the page is missing. */
export async function getPageLiveness(
  supabase: SupabaseClient,
  pageId: string,
): Promise<PageLiveness | null> {
  const { data: page } = await supabase
    .from("agencies")
    .select("id, owner_id, page_type, is_verified, is_blocked, deleted_at, deactivated_at, whatsapp_number, whatsapp_verified_at")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return null;

  const row = page as LivenessInput & { owner_id: string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", row.owner_id)
    .maybeSingle();

  return pageLiveness(row, (profile as { kyc_status?: string } | null)?.kyc_status === "verified");
}
