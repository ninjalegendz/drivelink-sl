"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { sriLankaToday } from "@/lib/dates/sri-lanka";

interface Props {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  label: string;
  disabled?: boolean;
  className?: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
}

function dateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * "Sat 26 Sep", the year only added when it is not the current year in Sri
 * Lanka time. Built from fixed abbreviation tables rather than
 * Intl.DateTimeFormat: "en-LK" fell back to US month-first ordering with
 * commas ("Sat, Sep 26, 2026") in this deployment's ICU data, which is what
 * truncated in the half-width booking form in the first place.
 */
function displayDate(value: string): string {
  if (!value) return "Choose date";
  const { year, month, day } = parts(value);
  const weekday = WEEKDAY_ABBR[new Date(year, month, day).getDay()];
  const base = `${weekday} ${day} ${MONTH_ABBR[month]}`;
  const currentYear = Number(sriLankaToday().slice(0, 4));
  return year === currentYear ? base : `${base} ${year}`;
}

/** Spelled-out date used as each day button's accessible name. */
function fullDate(value: string): string {
  const { year, month, day } = parts(value);
  return new Intl.DateTimeFormat("en-LK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(year, month, day));
}

export function DatePicker({ value, onChange, min, max, label, disabled = false, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value || min || dateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const selectedParts = parts(selected);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedParts.year, selectedParts.month, 1));

  useEffect(() => {
    const next = parts(selected);
    setVisibleMonth(new Date(next.year, next.month, 1));
  }, [selected]);

  const cells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= daysInMonth ? dateString(year, month, day) : null;
    });
  }, [visibleMonth]);

  const monthLabel = new Intl.DateTimeFormat("en-LK", { month: "long", year: "numeric" }).format(visibleMonth);
  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const previousMonthLastDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0);
  const previousMonthLast = dateString(previousMonthLastDate.getFullYear(), previousMonthLastDate.getMonth(), previousMonthLastDate.getDate());
  const nextMonthFirst = dateString(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
  const canPrevious = !min || previousMonthLast >= min;
  const canNext = !max || nextMonthFirst <= max;

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        // Matches <Input>: white ground, slate-300 edge. It was grey-filled,
        // which made every date field read as disabled next to the others.
        className="flex min-h-12 w-full items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3.5 text-left text-base text-slate-950 shadow-xs transition-[border-color,box-shadow] hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
        aria-label={`${label}: ${displayDate(value)}`}
        data-datepicker={label}
        data-value={value}
      >
        <CalendarDays size={17} className="shrink-0 text-slate-400" />
        <span className="min-w-0 truncate">{displayDate(value)}</span>
      </button>

      {open && (
        <BottomSheet title={label} closeLabel="Close date picker" onClose={() => setOpen(false)} className="md:max-w-sm">
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => canPrevious && setVisibleMonth(previousMonth)} disabled={!canPrevious} className="grid h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Previous month"><ChevronLeft size={19} /></button>
              <p className="text-base font-semibold tracking-tight text-slate-900">{monthLabel}</p>
              <button type="button" onClick={() => canNext && setVisibleMonth(nextMonth)} disabled={!canNext} className="grid h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Next month"><ChevronRight size={19} /></button>
            </div>
            <div className="mt-2 grid grid-cols-7" aria-hidden="true">
              {WEEKDAYS.map((weekday, index) => <span key={`${weekday}-${index}`} className="grid h-8 place-items-center text-xs font-semibold text-slate-500">{weekday}</span>)}
            </div>
            {/* Not role="grid": that promises rows and gridcells that were
                never here, which misleads a screen reader more than plain
                buttons do. Each day carries its full date as its accessible
                name, so it is announced as "Sunday, 16 August 2026" rather
                than a bare "16", and `data-date` gives tests a stable hook. */}
            <div className="grid grid-cols-7 gap-y-1" role="group" aria-label={monthLabel}>
              {cells.map((day, index) => {
                if (!day) return <span key={`blank-${index}`} className="h-11" />;
                const unavailable = Boolean((min && day < min) || (max && day > max));
                const active = day === value;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={active}
                    aria-label={fullDate(day)}
                    data-date={day}
                    onClick={() => { onChange(day); setOpen(false); }}
                    className={`mx-auto grid h-11 w-11 place-items-center rounded-full text-sm font-medium tabular transition-colors disabled:text-slate-300 disabled:line-through ${active ? "bg-blue-600 font-semibold text-white shadow-sm" : "text-slate-700 hover:bg-blue-50 hover:text-blue-800"}`}
                  >
                    {Number(day.slice(-2))}
                  </button>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
