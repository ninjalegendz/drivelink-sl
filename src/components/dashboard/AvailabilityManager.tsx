"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface Block {
  id:         string;
  start_date: string;
  end_date:   string;
  reason:     string | null;
  created_at: string;
}

/** A confirmed booking that already holds these dates. */
interface BookedRange {
  start_date: string;
  end_date:   string;
}

interface Props {
  vehicleId: string;
  agencyId:  string;
  initial:   Block[];
  /** Dates already committed to a renter, so blocking them can be flagged. */
  booked?:   BookedRange[];
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString("en-LK", opts);
  if (start === end) return s;
  const e = new Date(`${end}T00:00:00`).toLocaleDateString("en-LK", opts);
  return `${s} to ${e}`;
}

/** Today in Sri Lanka, not in UTC. toISOString() reports the previous day for
 *  the first 5.5 hours of every local day, which let the picker offer a date
 *  that had already passed. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Inclusive date ranges overlap unless one finishes before the other starts. */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function AvailabilityManager({ vehicleId, agencyId, initial, booked = [] }: Props) {
  const router  = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [start,  setStart]  = useState("");
  const [end,    setEnd]    = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Block | null>(null);
  const [removing, setRemoving] = useState(false);
  const [, startTransition] = useTransition();

  const today = localToday();

  // Surfaced before the owner commits, not after: blocking dates a renter
  // already holds does not cancel their booking, so silently accepting it
  // produced a calendar that disagreed with the bookings list.
  const clashingBooking = start && end
    ? booked.find((b) => overlaps(start, end, b.start_date, b.end_date))
    : undefined;

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!start || !end) { setError("Pick a start and end date."); return; }
    // A single-day block is legitimate (one day of servicing). The old check
    // demanded end > start, so the shortest block possible was two days.
    if (end < start)    { setError("The end date cannot be before the start date."); return; }

    const clash = blocks.find((b) => overlaps(start, end, b.start_date, b.end_date));
    if (clash) {
      setError(`These dates overlap a block you already have (${formatRange(clash.start_date, clash.end_date)}). Remove it first, or pick different dates.`);
      return;
    }

    setAdding(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("vehicle_blocks")
      .insert({
        vehicle_id: vehicleId,
        agency_id:  agencyId,
        start_date: start,
        end_date:   end,
        reason:     reason.trim() || null,
      })
      .select("id, start_date, end_date, reason, created_at")
      .single();

    setAdding(false);
    if (insertError) { setError(insertError.message); return; }

    setBlocks((prev) =>
      [...prev, data as Block].sort((a, b) => a.start_date.localeCompare(b.start_date))
    );
    setStart(""); setEnd(""); setReason("");
    startTransition(() => router.refresh());
  }

  async function removeBlock(block: Block) {
    setRemoving(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("vehicle_blocks")
      .delete()
      .eq("id", block.id);

    setRemoving(false);
    setPendingRemoval(null);
    if (deleteError) { setError(deleteError.message); return; }

    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">

      {/* At a glance: booked ranges and the owner's own blocks, so an owner
          can see both without cross-referencing the bookings list. */}
      <MonthCalendar blocks={blocks} booked={booked} today={today} />

      {/* Add new */}
      <form onSubmit={addBlock} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <h2 className="text-slate-900 font-semibold text-sm">Block a date range</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="text-slate-600 text-sm mb-1 block">Start date</span>
            <DatePicker value={start} min={today} onChange={setStart} label="Block start date" />
          </div>
          <div>
            <span className="text-slate-600 text-sm mb-1 block">End date</span>
            <DatePicker value={end} min={start || today} onChange={setEnd} label="Block end date" />
          </div>
        </div>
        <p className="text-slate-500 text-xs">
          Pick the same day twice to block a single day.
        </p>

        <div>
          <label htmlFor="block-reason" className="text-slate-600 text-sm mb-1 block">Reason (optional)</label>
          <input
            id="block-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. service, owner using, deep clean"
            maxLength={120}
            className="w-full min-h-11 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-base text-slate-900 placeholder-slate-400 focus:border-blue-500"
          />
          <p className="text-slate-500 text-xs mt-1">Internal note, renters only see the dates as unavailable, not the reason.</p>
        </div>

        {clashingBooking && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            A confirmed booking already covers {formatRange(clashingBooking.start_date, clashingBooking.end_date)}.
            Blocking these dates does not cancel it. Speak to the renter first, and cancel on the booking itself
            if the vehicle really is unavailable.
          </div>
        )}

        {error && <p role="alert" className="text-rose-600 text-sm font-medium">{error}</p>}

        <Button type="submit" loading={adding}>
          <Plus size={14} /> Block these dates
        </Button>
      </form>

      {/* Existing blocks */}
      <div>
        <h2 className="text-slate-900 font-semibold text-sm mb-3">Active blocks</h2>
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CalendarX size={32} strokeWidth={1.5} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm">No blocked periods yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-slate-900 text-sm font-medium">{formatRange(b.start_date, b.end_date)}</p>
                  {b.reason && (
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{b.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingRemoval(b)}
                  className="shrink-0 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove this blocked period?"
        consequence={
          pendingRemoval
            ? `${formatRange(pendingRemoval.start_date, pendingRemoval.end_date)} becomes bookable again straight away.`
            : ""
        }
        confirmLabel="Remove block"
        busy={removing}
        onConfirm={() => { if (pendingRemoval) void removeBlock(pendingRemoval); }}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}

function monthDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whether `day` falls inside any range in the list, inclusive. */
function withinAny(day: string, ranges: { start_date: string; end_date: string }[]): { start_date: string; end_date: string } | undefined {
  return ranges.find((r) => r.start_date <= day && day <= r.end_date);
}

/**
 * A month at a glance: booked ranges (a renter already holds these dates) and
 * the owner's own blocks, each tinted differently and drawn as a continuous
 * bar across the days they cover, with rounded ends only where a range
 * actually starts or ends, rather than a run of separate dots. Purely a
 * read-only view over the same `blocks`/`booked` props the list below uses,
 * it fetches nothing of its own.
 */
function MonthCalendar({
  blocks, booked, today,
}: {
  blocks: Block[];
  booked: BookedRange[];
  today: string;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-LK", { month: "long", year: "numeric" }).format(visibleMonth);

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= daysInMonth ? monthDateString(year, month, day) : null;
    });
  }, [year, month]);

  return (
    <Card padding="md">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
          className="grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold tracking-tight text-slate-900">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
          className="grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7" aria-hidden="true">
        {WEEKDAYS.map((weekday, index) => (
          <span key={`${weekday}-${index}`} className="grid h-7 place-items-center text-xs font-semibold text-slate-400">{weekday}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1" role="group" aria-label={monthLabel}>
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} className="h-9 sm:h-10" />;

          const bookedRange = withinAny(day, booked);
          const blockRange  = bookedRange ? undefined : withinAny(day, blocks);
          const range       = bookedRange ?? blockRange;
          const status: "booked" | "blocked" | null = bookedRange ? "booked" : blockRange ? "blocked" : null;
          const isStart = range ? day === range.start_date : false;
          const isEnd   = range ? day === range.end_date : false;
          const isToday = day === today;

          const fill = status === "booked"
            ? "bg-blue-600 text-white"
            : status === "blocked"
              ? "bg-amber-100 text-amber-900"
              : "text-slate-700";

          return (
            <span key={day} className="flex h-9 items-center sm:h-10" data-date={day}>
              <span
                className={`flex h-full w-full items-center justify-center text-xs font-medium tabular transition-colors ${fill} ${
                  isStart ? "rounded-l-full" : ""
                } ${isEnd ? "rounded-r-full" : ""} ${isToday && !status ? "ring-1 ring-inset ring-blue-400 rounded-full" : ""}`}
              >
                {Number(day.slice(-2))}
              </span>
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Booked by a renter
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-200" /> Blocked by you
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-blue-400" /> Today
        </span>
      </div>
    </Card>
  );
}
