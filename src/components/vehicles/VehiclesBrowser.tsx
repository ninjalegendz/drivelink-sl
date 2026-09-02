"use client";

import { useCallback, useEffect, useState } from "react";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { VehicleDetailModal } from "@/components/vehicles/VehicleDetailModal";
import type { VehicleWithAgency } from "@/types/queries";

interface LoadMore {
  /** Page size, also the threshold for whether more pages might exist. */
  pageSize: number;
  /** Current filter params, forwarded to /api/vehicles/search. */
  params: Record<string, string>;
}

/**
 * Renders a grid of vehicle cards. Clicking a card opens the detail + booking
 * modal in place (the card keeps a real /vehicles/[slug] href for SEO and
 * middle/right-click). `gridClassName` lets callers control the grid columns.
 *
 * When `loadMore` is provided, a "Load more" button fetches the next page from
 * /api/vehicles/search and appends it, keeping the initial page server-rendered
 * (SEO) while letting renters browse past the first page without a full reload.
 */
export function VehiclesBrowser({
  vehicles: initial,
  gridClassName = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
  loadMore,
}: {
  vehicles: VehicleWithAgency[];
  gridClassName?: string;
  loadMore?: LoadMore;
}) {
  const [vehicles, setVehicles] = useState<VehicleWithAgency[]>(initial);
  const [selected, setSelected] = useState<VehicleWithAgency | null>(null);
  const [loading, setLoading]   = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(loadMore ? initial.length >= loadMore.pageSize : false);

  // Re-seed when the server hands a fresh set (filters changed → new initial).
  useEffect(() => {
    setVehicles(initial);
    setHasMore(loadMore ? initial.length >= loadMore.pageSize : false);
    setLoadError(null);
  }, [initial, loadMore]);

  const onLoadMore = useCallback(async () => {
    if (!loadMore || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams(loadMore.params);
      qs.set("offset", String(vehicles.length));
      qs.set("limit", String(loadMore.pageSize));
      const res = await fetch(`/api/vehicles/search?${qs.toString()}`);
      if (!res.ok) throw new Error(`Vehicle search returned HTTP ${res.status}`);
      const data = (await res.json().catch(() => ({}))) as { vehicles?: VehicleWithAgency[] };
      const next = data.vehicles ?? [];
      // Guard against duplicates if the underlying set shifted between pages.
      setVehicles((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...next.filter((v) => !seen.has(v.id))];
      });
      setHasMore(next.length >= loadMore.pageSize);
    } catch {
      setLoadError("We couldn't load more vehicles. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [loadMore, loading, vehicles.length]);

  return (
    <>
      <div className={gridClassName}>
        {vehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} onOpen={setSelected} />
        ))}
      </div>

      {loadMore && hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-300 disabled:opacity-60 transition-colors shadow-sm"
          >
            {loading ? "Loading..." : loadError ? "Try loading again" : "Load more vehicles"}
          </button>
          {loadError && <p role="alert" className="text-sm text-rose-700 text-center">{loadError}</p>}
        </div>
      )}

      {selected && (
        <VehicleDetailModal vehicle={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
