import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { rankVehicles } from "@/data/vehicles";
import { toPublicVehicle } from "@/lib/vehicles/format";
import { createPublicClient } from "@/lib/supabase/server";
import type { VehicleRow, AgencySnippet, VehicleWithAgency } from "@/types/queries";

export const VEHICLES_PAGE_SIZE = 24;
const CACHE_TTL = 60; // seconds, public browse data can be ~1 min stale

export interface VehicleSearchParams {
  q?:        string | null;
  city?:     string | null;
  type?:     string | null;
  option?:   string | null;
  maxPrice?: number | null;
  from?:     string | null;
  to?:       string | null;
  limit?:    number;
  offset?:   number;
}

// Single source of truth for a page of marketplace vehicles. Runs the DB
// search_vehicles() function (filters + date-availability in SQL), hydrates the
// agency snippet for the returned page (bounded, so the IN-list is small),
// redacts plate numbers, then applies the in-app ranking. Shared by the listings
// page (first page) and the load-more API (subsequent pages) so they're identical.
export async function searchVehiclePage(
  supabase: SupabaseClient,
  p: VehicleSearchParams,
): Promise<VehicleWithAgency[]> {
  const { data } = await supabase.rpc("search_vehicles", {
    p_q:         p.q || null,
    p_city:      p.city || null,
    p_type:      p.type || null,
    p_option:    p.option || null,
    p_max_price: p.maxPrice ?? null,
    p_from:      p.from || null,
    p_to:        p.to || null,
    p_limit:     p.limit ?? VEHICLES_PAGE_SIZE,
    p_offset:    p.offset ?? 0,
  });
  const rows = (data ?? []) as VehicleRow[];
  if (rows.length === 0) return [];

  const agencyIds = [...new Set(rows.map((v) => v.agency_id))];
  const agencyById = new Map<string, AgencySnippet>();
  const { data: agencyRows } = await supabase
    .from("agencies")
    .select("id, owner_id, name, city, is_verified, reliability_pct, cancellation_count, avg_response_minutes, profiles!owner_id(rating_avg, rating_count)")
    .in("id", agencyIds);
  for (const a of (agencyRows ?? []) as unknown as AgencySnippet[]) agencyById.set(a.id, a);

  return rankVehicles(
    rows.map((v) => toPublicVehicle({ ...v, agencies: agencyById.get(v.agency_id) ?? null })) as VehicleWithAgency[],
  );
}

// Cached wrapper over searchVehiclePage for public reads. Keyed by the search
// params so each filter/page combo caches independently; ~60s staleness is fine
// for a browse page. Runs the cookieless anon client so it's safe inside
// unstable_cache (no request cookies). Used by the listings page + load-more API.
export async function searchVehiclePageCached(p: VehicleSearchParams): Promise<VehicleWithAgency[]> {
  const run = unstable_cache(
    () => searchVehiclePage(createPublicClient(), p),
    ["vehicle-search", JSON.stringify(p)],
    { revalidate: CACHE_TTL, tags: ["vehicles"] },
  );
  return run();
}

// Cached "newest available, ranked, top 6" for the home page.
export async function getHomeFeaturedCached(): Promise<VehicleWithAgency[]> {
  const run = unstable_cache(
    async () => {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("vehicles")
        .select("*, agencies(id, owner_id, name, city, is_verified, reliability_pct, cancellation_count, avg_response_minutes, profiles!owner_id(rating_avg, rating_count))")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(12);
      return rankVehicles((data ?? []) as VehicleWithAgency[]).slice(0, 6).map(toPublicVehicle);
    },
    ["home-featured"],
    { revalidate: CACHE_TTL, tags: ["vehicles"] },
  );
  return run();
}
