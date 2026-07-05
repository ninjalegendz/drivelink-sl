"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Info, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";
import { VEHICLE_TYPES, RENTAL_OPTIONS } from "@/data/vehicles";

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
  /** Result count, shown on the mobile sheet's "Show results" button. */
  resultCount?:     number;
}

export function VehiclesFilter({
  initialQ = "", initialCity = "", initialType = "", initialOption = "", initialMaxPrice = "",
  initialFrom = "", initialTo = "",
  resultCount,
}: Props) {
  const router = useRouter();
  const [q, setQ]               = useState(initialQ);
  const [city, setCity]         = useState(initialCity);
  const [type, setType]         = useState(initialType);
  const [option, setOption]     = useState(initialOption);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [from, setFrom]         = useState(initialFrom);
  const [to, setTo]             = useState(initialTo);
  const [sheetOpen, setSheetOpen] = useState(false); // mobile filter sheet

  const today = new Date().toISOString().slice(0, 10);
  const activeCount = [q, city, type, option, maxPrice, from, to].filter(Boolean).length;

  // Lock body scroll + Escape-to-close while the mobile sheet is open.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSheetOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [sheetOpen]);

  function push(next: Partial<Record<string, string>>) {
    const state = { q, city, type, option, max_price: maxPrice, from, to, ...next };
    const params = new URLSearchParams();
    if (state.q)         params.set("q", state.q);
    if (state.city)      params.set("city", state.city);
    if (state.type)      params.set("type", state.type);
    if (state.option)    params.set("option", state.option);
    if (state.max_price) params.set("max_price", state.max_price);
    if (state.from)      params.set("from", state.from);
    if (state.to)        params.set("to", state.to);
    const qs = params.toString();
    router.push(qs ? `/vehicles?${qs}` : "/vehicles");
  }

  function reset() {
    setQ(""); setCity(""); setType(""); setOption(""); setMaxPrice(""); setFrom(""); setTo("");
    router.push("/vehicles");
  }

  // Keep the return date on/after the pick-up date, then navigate.
  function setDates(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextTo < nextFrom) nextTo = nextFrom;
    setFrom(nextFrom);
    setTo(nextTo);
    push({ from: nextFrom, to: nextTo });
  }

  const controls = (
    <>
      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); push({}); }} className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Toyota, Royal Enfield…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors text-slate-900 placeholder-slate-400"
          />
        </div>
      </form>

      {/* Available dates, hides vehicles already booked for the trip */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available on</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={from}
            min={today}
            onChange={(e) => setDates(e.target.value, to)}
            className="w-full min-w-0 px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900"
            aria-label="Pick-up date"
          />
          <input
            type="date"
            value={to}
            min={from || today}
            onChange={(e) => setDates(from, e.target.value)}
            className="w-full min-w-0 px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900"
            aria-label="Return date"
          />
        </div>
        {(from || to) && (
          <button type="button" onClick={() => setDates("", "")} className="text-[11px] text-slate-400 hover:text-blue-600">
            Clear dates
          </button>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</label>
        <Select value={city} onChange={(v) => { setCity(v); push({ city: v }); }} options={CITY_OPTIONS} />
      </div>

      {/* Vehicle type */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle type</label>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => { setType(""); push({ type: "" }); }}
            className={`text-left px-3 py-2 text-sm rounded-lg transition-all ${type === "" ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
          >
            All categories
          </button>
          {VEHICLE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setType(t.value); push({ type: t.value }); }}
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
              onClick={() => { setOption(o.value); push({ option: o.value }); }}
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
        <Select value={maxPrice} onChange={(v) => { setMaxPrice(v); push({ max_price: v }); }} options={PRICE_OPTIONS} />
      </div>

      {/* Advantage note */}
      <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-1.5">
        <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" /> DriveLink advantage
        </h4>
        <p className="text-[11px] text-blue-700 leading-relaxed">
          Direct provider rates with zero added commission during our free launch period. You pay the listed local price.
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
      </div>

      {/* Mobile: compact trigger that opens the filter sheet (so results show first) */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="lg:hidden spring-press w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3"
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
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setSheetOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-t-3xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh] flex flex-col animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Filters
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={reset} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">
                  Reset all
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                  aria-label="Close filters"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto -mx-1 px-1 space-y-6 flex-1">{controls}</div>

            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-3 shrink-0 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              {typeof resultCount === "number"
                ? `Show ${resultCount} result${resultCount === 1 ? "" : "s"}`
                : "Show results"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
