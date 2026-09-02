import { Search } from "lucide-react";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { VehiclesFilter } from "@/components/vehicles/VehiclesFilter";
import { Hero } from "@/components/layout/Hero";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";
import { isValidSearchDateRange } from "@/lib/dates/sri-lanka";
import type { Metadata } from "next";
import { pageShellClass } from "@/components/ui/PageShell";

interface Props {
  searchParams: Promise<{ q?: string; city?: string; type?: string; option?: string; max_price?: string; from?: string; to?: string; from_time?: string; to_time?: string; insurance?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, city } = await searchParams;
  const title = [q, city, "Vehicle Rentals Sri Lanka"].filter(Boolean).join(" · ");
  return { title };
}

export default async function VehiclesPage({ searchParams }: Props) {
  const { q, city, type, option, max_price, from, to, from_time, to_time, insurance } = await searchParams;

  // Sanitize the free-text query before it reaches ILIKE (strip wildcards/delims).
  const safeQ = q ? q.replace(/[%_,():*.\\]/g, "").trim() : "";
  const hasDateFilter = Boolean(from || to);
  const dateOk = Boolean(from && to && isValidSearchDateRange(from, to));

  // First page. All filtering (incl. date availability) runs in the DB via
  // search_vehicles(); see src/lib/vehicles/search.ts. The result is edge-cached
  // (~60s) per filter combo. Subsequent pages come from /api/vehicles/search via
  // the Load-more button below.
  const vehicles = hasDateFilter && !dateOk ? [] : await searchVehiclePageCached({
    q:        safeQ || null,
    city:     city || null,
    type:     type || null,
    option:    option || null,
    maxPrice:  max_price && Number.isFinite(Number(max_price)) && Number(max_price) > 0 ? Number(max_price) : null,
    insurance: insurance || null,
    from:     dateOk ? from : null,
    to:       dateOk ? to : null,
    limit:    VEHICLES_PAGE_SIZE,
    offset:   0,
  });

  // Vehicles taken for the requested dates are returned rather than filtered
  // out, so the counts have to separate them or "24 options" would overstate
  // what can actually be booked.
  const unavailableCount = vehicles.filter((v) => v.booked_in_range || v.blocked_in_range).length;
  const bookableCount = vehicles.length - unavailableCount;

  return (
    <div className={pageShellClass("wide", "space-y-8")}>
      <Hero
        badge="Sri Lanka vehicle rentals"
        title={<>Find a vehicle that fits your trip.<br /><span className="text-blue-200">Send a request for free.</span></>}
        subtitle="Compare self-drive, with-driver and airport options. Each listing shows its provider, rental terms and recorded checks."
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
            initialFromTime={from_time ?? ""}
            initialToTime={to_time ?? ""}
            initialInsurance={insurance ?? ""}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Available vehicles</h2>
            {hasDateFilter && !dateOk ? (
              <p className="text-sm text-slate-600">Update the dates below to check which vehicles are available.</p>
            ) : (
              <p className="text-sm text-slate-600">
                {dateOk && unavailableCount > 0 ? (
                  <>
                    {bookableCount} available for your dates
                    {city ? ` in ${city}` : ""}
                    {q ? ` matching "${q}"` : ""}
                    {", "}
                    {unavailableCount} already taken (shown below, greyed out)
                  </>
                ) : (
                  <>
                    Showing {vehicles.length} option{vehicles.length === 1 ? "" : "s"}
                    {city ? ` in ${city}` : ""}
                    {q ? ` matching "${q}"` : ""}
                  </>
                )}
              </p>
            )}
          </div>

          {hasDateFilter && !dateOk ? (
            <div role="alert" className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              Choose a real pick-up date from tomorrow onward and a later return date to check availability.
            </div>
          ) : vehicles.length > 0 ? (
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
                  from_time: from_time ?? "",
                  to_time:   to_time ?? "",
                  insurance: insurance ?? "",
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
