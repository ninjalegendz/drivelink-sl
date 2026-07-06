// Rental Pages — active-page resolution.
//
// One DriveLink account can own many Rental Pages (rows in `agencies`;
// the table keeps its internal name, the product name is "Rental Page").
// The dashboard is always scoped to ONE page at a time: the "active" page,
// chosen with the page switcher and remembered in a cookie.
//
// Ownership is validated server-side on every read — the cookie is a hint,
// never an authority. RLS enforces the same ownership set underneath
// (`agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())`),
// so even a forged cookie can only ever select among the user's own pages.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RentalPageRow } from "@/types/queries";

export const ACTIVE_PAGE_COOKIE = "dl_active_page";

const PAGE_COLUMNS =
  "id, owner_id, name, description, address, city, whatsapp_number, email, " +
  "page_type, logo_url, cover_url, business_hours, business_reg_no, business_reg_url, " +
  "is_verified, is_blocked, cancellation_count, confirmed_count, strike_count, " +
  "reliability_pct, sms_notifications_enabled, whatsapp_notifications_enabled, " +
  "created_at, updated_at";

/** All live (non-deleted) Rental Pages owned by the user, oldest first. */
export async function getOwnedPages(
  supabase: SupabaseClient,
  userId: string,
): Promise<RentalPageRow[]> {
  const { data } = await supabase
    .from("agencies")
    .select(PAGE_COLUMNS)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as RentalPageRow[];
}

/**
 * The page the dashboard is currently scoped to: the cookie's page if the
 * user owns it, otherwise the first page they own, otherwise null (no pages
 * yet — caller should route to the create-page flow).
 */
export async function getActivePage(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ page: RentalPageRow | null; pages: RentalPageRow[] }> {
  const pages = await getOwnedPages(supabase, userId);
  if (pages.length === 0) return { page: null, pages };

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_PAGE_COOKIE)?.value;
  const page = pages.find((p) => p.id === wanted) ?? pages[0];
  return { page, pages };
}
