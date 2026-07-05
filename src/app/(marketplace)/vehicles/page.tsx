import { Search } from "lucide-react";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { VehiclesFilter } from "@/components/vehicles/VehiclesFilter";
import { Hero } from "@/components/layout/Hero";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";
import type { Metadata } from "next";

interface Props {
  searchParams: Promise<{ q?: string; city?: string; type?: string; option?: string; max_price?: string; from?: string; to?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, city } = await searchParams;
  const title = [q, city, "Vehicle Rentals Sri Lanka"].filter(Boolean).join(" · ");
  return { title };
}

export default async function VehiclesPage({ searchParams }: Props) {
  const { q, city, type, option, max_price, from, to } = await searchParams;

  // Sanitize the free-text query before it reaches ILIKE (strip wildcards/delims).
  const safeQ = q ? q.replace(/[%_,():*.\\]/g, "").trim() : "";
  const dateOk =
    !!from && !!to &&
    /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;

  // First page. All filtering (incl. date availability) runs in the DB via
  // search_vehicles(); see src/lib/vehicles/search.ts. The result is edge-cached
  // (~60s) per filter combo. Subsequent pages come from /api/vehicles/search via
  // the Load-more button below.
  const vehicles = await searchVehiclePageCached({
    q:        safeQ || null,
    city:     city || null,
    type:     type || null,
    option:   option || null,
    maxPrice: max_price ? parseInt(max_price) : null,
    from:     dateOk ? from : null,
    to:       dateOk ? to : null,
    limit:    VEHICLES_PAGE_SIZE,
    offset:   0,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <Hero
        badge="Sri Lanka's Verified Rental Network"
        title={<>Find your ride.<br /><span className="text-blue-400">Zero platform fees.</span></>}
        subtitle="Verified cars, SUVs, vans, bikes and tuk-tuks from trusted local owners, self-drive, with a driver, or airport pickup."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <VehiclesFilter
            initialQ={q ?? ""}
            initialCity={city ?? ""}
            initialType={type ?? ""}
            initialOption={option ?? ""}
            initialMaxPrice={max_price ?? ""}
            initialFrom={from ?? ""}
            initialTo={to ?? ""}
            resultCount={vehicles.length}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Verified vehicles</h2>
            <p className="text-xs text-slate-400">
              Showing {vehicles.length} tourist-ready option{vehicles.length === 1 ? "" : "s"}
              {city ? ` in ${city}` : ""}
              {q ? ` matching "${q}"` : ""}
            </p>
          </div>

          {vehicles.length > 0 ? (
            <VehiclesBrowser
              vehicles={vehicles}
              gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              loadMore={{
                pageSize: VEHICLES_PAGE_SIZE,
                params: {
                  q:         q ?? "",
                  city:      city ?? "",
                  type:      type ?? "",
                  option:    option ?? "",
                  max_price: max_price ?? "",
                  from:      from ?? "",
                  to:        to ?? "",
                },
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-100 text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <Search className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-700">No vehicles match your filters</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">Try widening the location, vehicle type, or rental option.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
