"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, CalendarDays, Info, Check, MapPin } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/ui/Chip";
import { inputBase, inputEdge } from "@/components/ui/Input";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import { DatePicker } from "@/components/ui/DatePicker";
import { SL_CITIES } from "@/data/cities";
import { VEHICLE_TYPES, RENTAL_OPTIONS } from "@/data/vehicles";
import { addCalendarDays, isValidSearchDateRange, sriLankaToday } from "@/lib/dates/sri-lanka";
import { trackTrafficEvent } from "@/lib/analytics/client";

const CITY_OPTIONS = [
  { value: "", label: "Anywhere in Sri Lanka" },
  ...SL_CITIES.map((c) => ({ value: c, label: c })),
];

const PRICE_OPTIONS = [
  { value: "",      label: "Any price" },
  { value: "3000",  label: "Under Rs. 3,000 / day" },
  { value: "5000",  label: "Under Rs. 5,000 / day" },
  { value: "8000",  label: "Under Rs. 8,000 / day" },
  { value: "12000", label: "Under Rs. 12,000 / day" },
  { value: "25000", label: "Under Rs. 25,000 / day" },
];

interface Props {
  initialQ?:        string;
  initialCity?:     string;
  initialType?:     string;
  initialOption?:   string;
  initialMaxPrice?: string;
  initialFrom?:     string;
  initialTo?:       string;
  /** Carried, not edited. The pick-up and return times come from the home-page
   *  search; this panel deliberately has no time controls, but it must not drop
   *  what the renter already chose when they change a filter here. */
  initialFromTime?: string;
  initialToTime?:   string;
  initialInsurance?: string;
}

/** A field name → the day's short display, "16 Aug", for the dates chip. */
function shortDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-LK", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

/** One row in a single-choice sheet (vehicle type, price): same shape as the
 *  option rows inside <Select>'s own mobile sheet, so a renter moving between
 *  the two never meets a different pattern for "pick one from a list". */
function OptionRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl px-3.5 text-left text-base transition-colors ${active ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}
    >
      <span>{label}</span>
      {active && <Check size={18} className="text-blue-600" />}
    </button>
  );
}

export function VehiclesFilter({
  initialQ = "", initialCity = "", initialType = "", initialOption = "", initialMaxPrice = "",
  initialFrom = "", initialTo = "", initialFromTime = "", initialToTime = "", initialInsurance = "",
}: Props) {
  const router = useRouter();
  const [q, setQ]               = useState(initialQ);
  const [city, setCity]         = useState(initialCity);
  const [type, setType]         = useState(initialType);
  const [option, setOption]     = useState(initialOption);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [from, setFrom]         = useState(initialFrom);
  const [to, setTo]             = useState(initialTo);
  const [insurance, setInsurance] = useState(initialInsurance);
  const [datesSheetOpen, setDatesSheetOpen]     = useState(false);
  const [typeSheetOpen, setTypeSheetOpen]       = useState(false);
  const [priceSheetOpen, setPriceSheetOpen]     = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen]       = useState(false);
  const [cityQuery, setCityQuery]               = useState("");
  const [searching, startTransition] = useTransition();
  const [dateError, setDateError] = useState("");

  useEffect(() => {
    setQ(initialQ);
    setCity(initialCity);
    setType(initialType);
    setOption(initialOption);
    setMaxPrice(initialMaxPrice);
    setFrom(initialFrom);
    setTo(initialTo);
    setInsurance(initialInsurance);
  }, [initialCity, initialFrom, initialInsurance, initialMaxPrice, initialOption, initialQ, initialTo, initialType]);

  const firstBookableDate = addCalendarDays(sriLankaToday(), 1);
  const activeCount = [q, city, type, option, maxPrice, from, to, insurance].filter(Boolean).length;

  type Fields = { q: string; city: string; type: string; option: string; maxPrice: string; from: string; to: string; insurance: string };

  // Every control in this bar ends up here. Chips call it the moment they are
  // tapped, passing their new value straight through rather than waiting for
  // a re-render to read it off state (setState is async, the click handler's
  // own closure would still see the old value). The big "Filters" sheet and
  // the dates sheet call it with no override, once the renter taps their own
  // explicit "Show results" button, since those batch a few changes together.
  function navigate(next: Partial<Fields> = {}): boolean {
    const values: Fields = { q, city, type, option, maxPrice, from, to, insurance, ...next };
    if ((values.from || values.to) && !isValidSearchDateRange(values.from, values.to)) {
      setDateError("Choose a pick-up date from tomorrow onward and a later return date.");
      setDatesSheetOpen(true);
      return false;
    }
    setDateError("");
    const params = new URLSearchParams();
    if (values.q.trim())  params.set("q", values.q.trim());
    if (values.city)      params.set("city", values.city);
    if (values.type)      params.set("type", values.type);
    if (values.option)    params.set("option", values.option);
    if (values.maxPrice)  params.set("max_price", values.maxPrice);
    if (values.from)      params.set("from", values.from);
    if (values.to)        params.set("to", values.to);
    // Only meaningful alongside a range, and only ever passed through.
    if (values.from && values.to && initialFromTime) params.set("from_time", initialFromTime);
    if (values.from && values.to && initialToTime)   params.set("to_time", initialToTime);
    if (values.insurance) params.set("insurance", values.insurance);
    const qs = params.toString();
    const count = Object.values(values).filter(Boolean).length;
    trackTrafficEvent({ event: "search_submitted", entityType: "search", entityId: "vehicle-search", label: `${count} active filters` });
    startNavigationProgress();
    startTransition(() => router.push(qs ? `/vehicles?${qs}` : "/vehicles"));
    return true;
  }

  function reset() {
    setQ(""); setCity(""); setType(""); setOption(""); setMaxPrice(""); setFrom(""); setTo(""); setInsurance("");
    setDateError("");
    setDatesSheetOpen(false); setTypeSheetOpen(false); setPriceSheetOpen(false); setFiltersSheetOpen(false); setCitySheetOpen(false);
    startNavigationProgress();
    startTransition(() => router.push("/vehicles"));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate();
  }

  // Rental option is single-select: tapping the active one clears it.
  function chooseOption(value: string) {
    const next = option === value ? "" : value;
    setOption(next);
    navigate({ option: next });
  }

  function toggleInsurance() {
    const next = insurance === "hire" ? "" : "hire";
    setInsurance(next);
    navigate({ insurance: next });
  }

  function chooseType(value: string) {
    setType(value);
    setTypeSheetOpen(false);
    navigate({ type: value });
  }

  function choosePrice(value: string) {
    setMaxPrice(value);
    setPriceSheetOpen(false);
    navigate({ maxPrice: value });
  }

  function chooseCity(value: string) {
    setCity(value);
    setCitySheetOpen(false);
    setCityQuery("");
    navigate({ city: value });
  }

  // Keep the return date on/after the pick-up date before applying filters.
  function setDates(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextTo <= nextFrom) nextTo = "";
    setDateError("");
    setFrom(nextFrom);
    setTo(nextTo);
  }

  function applyDates() {
    if (navigate()) setDatesSheetOpen(false);
  }

  function applyFiltersSheet() {
    if (navigate()) setFiltersSheetOpen(false);
  }

  return (
    <div className="sticky top-16 z-30 glass-bar border-b border-slate-900/[0.06]">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="scrollbar-none mask-fade-x flex items-center gap-2 overflow-x-auto">
          {/* Search */}
          <form onSubmit={submitSearch} className="relative shrink-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vehicles"
              aria-label="Search vehicles"
              className="h-10 w-36 rounded-full border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-xs transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 sm:w-48"
            />
          </form>

          {/* Available dates, hides vehicles already booked for the trip */}
          <Chip active={Boolean(from || to)} onClick={() => setDatesSheetOpen(true)}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {from && to ? <>{shortDate(from)} <span aria-hidden="true">&rarr;</span> {shortDate(to)}</> : "Any dates"}
          </Chip>

          {/* Location. A chip like its neighbours rather than a full select
              box, which sat at the end of the row as the one control that
              looked different and was always half cut off by the edge fade. */}
          <Chip active={Boolean(city)} onClick={() => setCitySheetOpen(true)}>
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {city || "Anywhere"}
          </Chip>

          {/* Rental option, single-select: tap the active one again to clear */}
          {RENTAL_OPTIONS.map((o) => (
            <Chip key={o.value} active={option === o.value} onClick={() => chooseOption(o.value)}>
              {o.label}
            </Chip>
          ))}

          {/* Insurance (TRUST-023) */}
          <Chip active={insurance === "hire"} onClick={toggleInsurance}>Hire insurance</Chip>

          {/* Vehicle type */}
          <Chip active={Boolean(type)} onClick={() => setTypeSheetOpen(true)}>
            {type ? VEHICLE_TYPES.find((t) => t.value === type)?.plural : "Vehicle type"}
          </Chip>

          {/* Max price */}
          <Chip active={Boolean(maxPrice)} onClick={() => setPriceSheetOpen(true)}>
            {maxPrice ? PRICE_OPTIONS.find((p) => p.value === maxPrice)?.label : "Price"}
          </Chip>

          {/* Everything above, in one sheet, for a thumb that would rather
              not scroll the row: the primary way to filter on a phone. */}
          <Chip active={activeCount > 0} count={activeCount} onClick={() => setFiltersSheetOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Filters
          </Chip>

          {activeCount > 0 && (
            <button type="button" onClick={reset} className="shrink-0 whitespace-nowrap px-2 text-sm font-medium text-blue-700 hover:text-blue-900">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Subtle stand-in for a spinner: a navigation is already under way by
          the time any of the above fires (see startNavigationProgress), this
          just keeps the bar itself from looking idle while it waits. */}
      {searching && <div aria-hidden="true" className="h-0.5 animate-pulse bg-blue-600/70" />}

      {/* Dates sheet: two pickers need to agree before either is useful, so
          unlike the rest of this bar it keeps its own explicit apply step. */}
      {datesSheetOpen && (
        <BottomSheet
          title="Dates"
          closeLabel="Close dates"
          onClose={() => setDatesSheetOpen(false)}
          className="md:max-w-sm"
          actions={(from || to) ? (
            <button type="button" onClick={() => setDates("", "")} className="min-h-9 px-2 text-sm font-medium text-slate-500 hover:text-blue-700">
              Clear
            </button>
          ) : undefined}
        >
          <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={from} min={firstBookableDate} onChange={(value) => setDates(value, to)} label="Pick-up date" />
              <DatePicker value={to} min={from ? addCalendarDays(from, 1) : addCalendarDays(firstBookableDate, 1)} onChange={(value) => setDates(from, value)} label="Return date" />
            </div>
            {dateError && <p role="alert" className="text-xs leading-relaxed text-rose-700">{dateError}</p>}
            <button
              type="button"
              onClick={applyDates}
              disabled={searching}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
            >
              {searching && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              Show results
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Vehicle type sheet: one tap picks and applies, no separate step. */}
      {typeSheetOpen && (
        <BottomSheet title="Vehicle type" closeLabel="Close vehicle type" onClose={() => setTypeSheetOpen(false)}>
          <div className="max-h-[70dvh] space-y-0.5 overflow-y-auto p-2 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            <OptionRow label="All vehicle types" active={type === ""} onClick={() => chooseType("")} />
            {VEHICLE_TYPES.map((t) => (
              <OptionRow key={t.value} label={t.plural} active={type === t.value} onClick={() => chooseType(t.value)} />
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Location sheet: 25 districts is too many to scan, so a filter box
          narrows the list as the renter types. One tap applies. */}
      {citySheetOpen && (
        <BottomSheet title="Location" closeLabel="Close location" onClose={() => { setCitySheetOpen(false); setCityQuery(""); }}>
          <div className="border-b border-slate-100 p-3">
            <input
              type="search"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Type a district"
              aria-label="Filter districts"
              className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
            />
          </div>
          <div className="max-h-[60dvh] space-y-0.5 overflow-y-auto p-2 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            {!cityQuery.trim() && (
              <OptionRow label="Anywhere in Sri Lanka" active={city === ""} onClick={() => chooseCity("")} />
            )}
            {SL_CITIES.filter((c) => c.toLowerCase().includes(cityQuery.trim().toLowerCase())).map((c) => (
              <OptionRow key={c} label={c} active={city === c} onClick={() => chooseCity(c)} />
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Price sheet: same one-tap pattern. */}
      {priceSheetOpen && (
        <BottomSheet title="Price" closeLabel="Close price" onClose={() => setPriceSheetOpen(false)}>
          <div className="max-h-[70dvh] space-y-0.5 overflow-y-auto p-2 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            {PRICE_OPTIONS.map((p) => (
              <OptionRow key={p.value || "any"} label={p.label} active={maxPrice === p.value} onClick={() => choosePrice(p.value)} />
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Everything at once, for a phone: batches every field and only
          navigates when "Show results" is tapped. */}
      {filtersSheetOpen && (
        <BottomSheet
          title="Filters"
          closeLabel="Close filters"
          onClose={() => setFiltersSheetOpen(false)}
          actions={activeCount > 0 ? (
            <button type="button" onClick={reset} className="min-h-9 px-2 text-sm font-medium text-blue-700 hover:text-blue-900">Reset</button>
          ) : undefined}
        >
          <div className="flex max-h-[calc(85dvh-3.5rem)] flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              {/* Search */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Search</p>
                <form onSubmit={submitSearch}>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Toyota, Royal Enfield..."
                      aria-label="Search vehicles"
                      className={`${inputBase} min-h-12 pl-9 ${inputEdge()}`}
                    />
                  </div>
                </form>
              </div>

              {/* Available dates, hides vehicles already booked for the trip */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available on</p>
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={from} min={firstBookableDate} onChange={(value) => setDates(value, to)} label="Pick-up date" />
                  <DatePicker value={to} min={from ? addCalendarDays(from, 1) : addCalendarDays(firstBookableDate, 1)} onChange={(value) => setDates(from, value)} label="Return date" />
                </div>
                {dateError && <p role="alert" className="text-xs leading-relaxed text-rose-700">{dateError}</p>}
                {(from || to) && (
                  <button type="button" onClick={() => setDates("", "")} className="min-h-9 text-xs text-slate-500 hover:text-blue-700">
                    Clear dates
                  </button>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location</p>
                <Select value={city} onChange={setCity} options={CITY_OPTIONS} label="City" />
              </div>

              {/* Insurance (TRUST-023) */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Insurance</p>
                <Chip active={insurance === "hire"} onClick={() => setInsurance(insurance === "hire" ? "" : "hire")}>
                  Hire insurance listed
                </Chip>
              </div>

              {/* Vehicle type */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle type</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={type === ""} onClick={() => setType("")}>All types</Chip>
                  {VEHICLE_TYPES.map((t) => (
                    <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>{t.plural}</Chip>
                  ))}
                </div>
              </div>

              {/* Rental option */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rental option</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={option === ""} onClick={() => setOption("")}>Any option</Chip>
                  {RENTAL_OPTIONS.map((o) => (
                    <Chip key={o.value} active={option === o.value} onClick={() => setOption(o.value)}>{o.label}</Chip>
                  ))}
                </div>
              </div>

              {/* Max price */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Max budget</p>
                <Select value={maxPrice} onChange={setMaxPrice} options={PRICE_OPTIONS} label="Maximum price" />
              </div>

              {/* Advantage note */}
              <div className="flex items-start gap-2 rounded-xl bg-blue-50/70 p-3.5 ring-1 ring-blue-100">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-blue-800">
                  Rental and deposit amounts are arranged directly with the Rental Page. DriveLink&apos;s booking confirmation fee is Rs. 0.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={applyFiltersSheet}
                disabled={searching}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
              >
                {searching && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Show results
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
