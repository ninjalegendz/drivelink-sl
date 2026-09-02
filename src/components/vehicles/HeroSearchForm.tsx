"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import { SL_CITIES } from "@/data/cities";
import { VEHICLE_TYPES } from "@/data/vehicles";
import { sriLankaToday, addCalendarDays, isValidSearchDateRange } from "@/lib/dates/sri-lanka";

const CITY_OPTIONS = [{ value: "", label: "Anywhere in Sri Lanka" }, ...SL_CITIES.map((c) => ({ value: c, label: c }))];
const TYPE_OPTIONS = [{ value: "", label: "Any vehicle" }, ...VEHICLE_TYPES.map((t) => ({ value: t.value, label: t.plural }))];

// Half-hour slots, the same grid the booking form offers, so a time chosen here
// is one the booking form can actually accept.
const PAD = (n: number) => String(n).padStart(2, "0");
const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => `${PAD(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${PAD(m)} ${h < 12 ? "AM" : "PM"}`;
}
const TIME_OPTIONS = HALF_HOUR_SLOTS.map((t) => ({ value: t, label: to12h(t) }));

interface Props {
  initialFrom?: string;
  initialTo?: string;
  initialFromTime?: string;
  initialToTime?: string;
  initialCity?: string;
  initialType?: string;
}

/**
 * The search that starts a trip.
 *
 * Deliberately three questions, not six. An earlier version put every field in
 * the hero at once - two dates, two times, type and city - which read as a
 * filter panel bolted onto the banner rather than an invitation to start. Where
 * and when are what someone actually knows when they arrive; times and vehicle
 * type are refinements, so they sit behind one quiet toggle and open already
 * filled in if the visitor arrived with them set.
 *
 * Times are collected because a renter has a real pick-up hour in mind and it
 * carries into the booking request, but availability itself is judged by whole
 * days, which is how the booking overlap check already works. Being finer would
 * mean showing a car as free at 10am when it is due back at 9:30am, and a clash
 * found at handover is far worse than one avoided in search.
 */
export function HeroSearchForm({
  initialFrom = "", initialTo = "", initialFromTime = "", initialToTime = "",
  initialCity = "", initialType = "",
}: Props) {
  const router = useRouter();
  const today = sriLankaToday();
  // Pick-up starts tomorrow: the platform asks for 24 hours of lead time.
  const earliest = addCalendarDays(today, 1);

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [fromTime, setFromTime] = useState(initialFromTime || "10:00");
  const [toTime, setToTime] = useState(initialToTime || "10:00");
  const [city, setCity] = useState(initialCity);
  const [type, setType] = useState(initialType);
  const [error, setError] = useState("");
  // Open only if the visitor already has something in there worth seeing.
  const [showMore, setShowMore] = useState(Boolean(initialType || initialFromTime || initialToTime));

  function submit(e: React.FormEvent) {
    e.preventDefault();

    // Dates are optional: searching with none is a plain browse. A half-filled
    // range cannot be answered, so it is refused rather than quietly ignored.
    if ((from || to) && !isValidSearchDateRange(from, to)) {
      setError("Choose a pick-up date from tomorrow onward and a return date after it.");
      return;
    }
    setError("");

    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    if (from && to) {
      params.set("from", from);
      params.set("to", to);
      params.set("from_time", fromTime);
      params.set("to_time", toTime);
    }
    const qs = params.toString();
    startNavigationProgress();
    router.push(qs ? `/vehicles?${qs}` : "/vehicles");
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-3 shadow-xl sm:p-4">
      {/* One row on desktop, stacked on a phone. Each control is its own
          labelled cell so nothing has to be guessed at. */}
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
        <Cell label="Where">
          <Select value={city} onChange={setCity} options={CITY_OPTIONS} label="Where" placeholder="Anywhere in Sri Lanka" className={CONTROL} />
        </Cell>
        <Cell label="Pick-up">
          <DatePicker
            value={from}
            min={earliest}
            onChange={(v) => { setFrom(v); if (to && to <= v) setTo(addCalendarDays(v, 1)); }}
            label="Pick-up date"
            className={CONTROL}
          />
        </Cell>
        <Cell label="Return">
          <DatePicker
            value={to}
            min={from ? addCalendarDays(from, 1) : addCalendarDays(earliest, 1)}
            onChange={setTo}
            label="Return date"
            className={CONTROL}
          />
        </Cell>

        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-700 md:min-w-[7.5rem]"
        >
          <Search size={18} /> Search
        </button>
      </div>

      {showMore && (
        <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-3">
          <Cell label="Pick-up time">
            <Select value={fromTime} onChange={setFromTime} options={TIME_OPTIONS} label="Pick-up time" className={CONTROL} />
          </Cell>
          <Cell label="Return time">
            <Select value={toTime} onChange={setToTime} options={TIME_OPTIONS} label="Return time" className={CONTROL} />
          </Cell>
          <Cell label="Vehicle type">
            <Select value={type} onChange={setType} options={TYPE_OPTIONS} label="Vehicle type" placeholder="Any vehicle" className={CONTROL} />
          </Cell>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700"
      >
        {showMore ? <Minus size={14} /> : <Plus size={14} />}
        {showMore ? "Hide times and vehicle type" : "Add times or vehicle type"}
      </button>
    </form>
  );
}

// Select pads with py-2.5 while DatePicker relies on min-height alone, so the
// two render 2-3px apart and the row's labels end up misaligned. Pinning both
// triggers to the same height is what makes the bar read as one control strip.
const CONTROL = "[&>button]:min-h-12 [&>button]:rounded-xl";

/** Label above a control. A plain span, never a <label> wrapper: these hold
 *  Select and DatePicker, which open a sheet that removes itself on tap, and a
 *  <label> ancestor turns that into a reopen loop on iOS. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}
