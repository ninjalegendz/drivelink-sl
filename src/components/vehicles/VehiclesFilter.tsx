"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Info } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
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
  const [sheetOpen, setSheetOpen] = useState(false); // mobile filter sheet
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

  function applyFilters() {
    if ((from || to) && !isValidSearchDateRange(from, to)) {
      setDateError("Choose a pick-up date from tomorrow onward and a later return date.");
      return;
    }
    setDateError("");
    const params = new URLSearchParams();
    if (q.trim())  params.set("q", q.trim());
    if (city)      params.set("city", city);
    if (type)      params.set("type", type);
    if (option)    params.set("option", option);
    if (maxPrice)  params.set("max_price", maxPrice);
    if (from)      params.set("from", from);
    if (to)        params.set("to", to);
    // Only meaningful alongside a range, and only ever passed through.
    if (from && to && initialFromTime) params.set("from_time", initialFromTime);
    if (from && to && initialToTime)   params.set("to_time", initialToTime);
    if (insurance) params.set("insurance", insurance);
    const qs = params.toString();
    trackTrafficEvent({ event: "search_submitted", entityType: "search", entityId: "vehicle-search", label: `${activeCount} active filters` });
    startNavigationProgress();
    startTransition(() => router.push(qs ? `/vehicles?${qs}` : "/vehicles"));
    setSheetOpen(false);
  }

  function reset() {
    setQ(""); setCity(""); setType(""); setOption(""); setMaxPrice(""); setFrom(""); setTo(""); setInsurance("");
    setDateError("");
    startNavigationProgress();
    startTransition(() => router.push("/vehicles"));
    setSheetOpen(false);
  }

  function toggleInsurance() {
    const next = insurance === "hire" ? "" : "hire";
    setInsurance(next);
  }

  // Keep the return date on/after the pick-up date before applying filters.
  function setDates(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextTo <= nextFrom) nextTo = "";
    setDateError("");
    setFrom(nextFrom);
    setTo(nextTo);
  }

  const controls = (
    <>
      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }} className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Toyota, Royal Enfield..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white transition-colors text-slate-900 placeholder-slate-400"
          />
        </div>
      </form>

      {/* Available dates, hides vehicles already booked for the trip */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available on</label>
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
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</label>
        <Select value={city} onChange={setCity} options={CITY_OPTIONS} label="City" />
      </div>

      {/* Insurance (TRUST-023) */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Insurance</label>
        <button
          type="button"
          onClick={toggleInsurance}
          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${insurance === "hire" ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50 border border-slate-200"}`}
        >
          {insurance === "hire" ? "Selected: " : ""}Hire insurance listed
        </button>
      </div>

      {/* Vehicle type */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle type</label>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setType("")}
            className={`text-left px-3 py-2 text-sm rounded-lg transition-all ${type === "" ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
          >
            All categories
          </button>
          {VEHICLE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`text-left px-3 py-2 text-sm rounded-lg transition-all ${type === t.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {t.plural}
            </button>
          ))}
        </div>
      </div>

      {/* Rental option */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rental option</label>
        <div className="grid grid-cols-2 gap-2">
          {([{ value: "", label: "Any option" }, ...RENTAL_OPTIONS] as { value: string; label: string }[]).map((o) => (
            <button
              key={o.value || "any"}
              type="button"
              onClick={() => setOption(o.value)}
              className={`px-2 py-1.5 text-xs rounded-lg border text-center font-medium transition-all ${option === o.value ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max price */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Max budget</label>
        <Select value={maxPrice} onChange={setMaxPrice} options={PRICE_OPTIONS} label="Maximum price" />
      </div>

      {/* Advantage note */}
      <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-1.5">
        <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" /> DriveLink advantage
        </h4>
        <p className="text-xs text-blue-700 leading-relaxed">
          Rental and deposit amounts are arranged directly with the Rental Page. DriveLink&apos;s booking confirmation fee is Rs. 0.
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden lg:block bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Filters
          </h3>
          <button onClick={reset} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">
            Reset all
          </button>
        </div>
        {controls}
        <button type="button" onClick={applyFilters} disabled={searching} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70">
          {searching && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {searching ? "Searching…" : "Apply filters"}
        </button>
      </div>

      {/* Mobile: compact trigger that opens the filter sheet (so results show first) */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        className="lg:hidden flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm hover:border-blue-400"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-800">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Filters
        </span>
        {activeCount > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-blue-600 text-white rounded-full">
            {activeCount}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Tap to refine</span>
        )}
      </button>

      {/* Mobile bottom sheet */}
      {sheetOpen && (
        <BottomSheet
          title="Filters"
          closeLabel="Close filters"
          onClose={() => setSheetOpen(false)}
          className="lg:hidden"
          actions={<button type="button" onClick={reset} className="min-h-11 px-2 text-sm font-medium text-blue-700 hover:text-blue-900">Reset</button>}
        >
          <div className="flex max-h-[calc(85vh-3.5rem)] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex-1 space-y-6 overflow-y-auto py-5">{controls}</div>
            <button
              type="button"
              onClick={applyFilters}
              disabled={searching}
              className="mt-3 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
            >
              {searching && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              Show results
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
