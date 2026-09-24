import Link from "next/link";
import { Search } from "lucide-react";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { VehiclesFilter } from "@/components/vehicles/VehiclesFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";
import { isValidSearchDateRange } from "@/lib/dates/sri-lanka";
import { VEHICLE_TYPES } from "@/data/vehicles";
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

// Sentence-case words for the page title. RENTAL_OPTIONS' own labels
// ("Self-Drive", "With Driver") are title-cased for chips and buttons, not
// for reading inline in a sentence like "Self-drive vehicles".
const OPTION_TITLE_WORD: Record<string, string> = {
  "self-drive": "Self-drive",
  "with-driver": "With driver",
  "airport-pickup": "Airport handover",
};

/**
 * Builds the compact header's headline from whatever the renter is
 * currently filtering by, e.g. "Vans & Minibuses in Kandy", "Self-drive
 * vehicles", or the default "Vehicles across Sri Lanka" when nothing narrows
 * the fleet down yet. The free-text query is deliberately left out: it
 * already shows up in the count line below, and folding it in here made the
 * headline unreadable for anything longer than a couple of words.
 */
function resultsTitle(type: string, city: string, option: string): string {
  const typeNoun = type ? VEHICLE_TYPES.find((t) => t.value === type)?.plural : null;
  const optionWord = option ? OPTION_TITLE_WORD[option] : null;

  const subject = optionWord && typeNoun
    ? `${optionWord} ${typeNoun.toLowerCase()}`
    : optionWord
      ? `${optionWord} vehicles`
      : typeNoun ?? "Vehicles";

  if (city) return `${subject} in ${city}`;
  return subject === "Vehicles" ? "Vehicles across Sri Lanka" : subject;
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
    <>
      {/* No marketing hero here: results come first, right under the sticky
          filter bar that replaces it. */}
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

      <div className={pageShellClass("wide", "space-y-6")}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {resultsTitle(type ?? "", city ?? "", option ?? "")}
          </h1>
          {hasDateFilter && !dateOk ? (
            <p className="mt-1 text-sm text-slate-600">Update the dates below to check which vehicles are available.</p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
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
          <div role="alert" className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-950 ring-1 ring-amber-200">
            Choose a real pick-up date from tomorrow onward and a later return date to check availability.
          </div>
        ) : vehicles.length > 0 ? (
          <div className="animate-fade-in">
            <VehiclesBrowser
              vehicles={vehicles}
              gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-10"
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
          </div>
        ) : (
          <EmptyState
            icon={<Search size={22} />}
            title="No vehicles match these filters"
            description="Try a wider location, a different vehicle type, or fewer filters at once."
            action={
              <Link href="/vehicles" className={buttonClasses({ variant: "secondary" })}>Clear filters</Link>
            }
          />
        )}
      </div>
    </>
  );
}
