// Booking subtotal calculation, shared between the API and the booking form.
//
// Calendar-aware: a "month" means a full calendar month from start_date,
// not a fixed 30 days. So May 10 → June 10 = 1 month even though May has
// 31 days. This stays accurate across months with different lengths.

export interface PriceBreakdown {
  fullMonths:    number;
  remainingDays: number;
  monthsCost:    number;
  daysCost:      number;
  subtotal:      number;
}

export interface PriceInputs {
  startDate:      string;  // YYYY-MM-DD
  endDate:        string;  // YYYY-MM-DD (exclusive, return day)
  dailyRateLkr:   number;
  monthlyRateLkr?: number | null;
}

/**
 * Billable days between two pick-up / return datetimes, in STRICT 24-hour
 * blocks: any started extra time rounds up to a full day, minimum 1 day.
 * A 15-minute-late return adds a whole day. Mirrors the DB's generated
 * `total_days` so the form preview, API and database always agree.
 *
 * @param startISO "YYYY-MM-DDTHH:mm" (local)
 * @param endISO   "YYYY-MM-DDTHH:mm" (local)
 */
export function billableDaysBetween(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** Combine a date + time into the "YYYY-MM-DDTHH:mm" form the helpers expect. */
export function toDateTime(date: string, time: string): string {
  return `${date}T${(time || "10:00").slice(0, 5)}`;
}

function parseUTC(iso: string): Date {
  // Treat the date as UTC midnight so DST and locale don't shift the day count.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetweenUTC(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Advance a date by exactly one calendar month. If the source day-of-month
// doesn't exist in the target month (e.g. Jan 31 + 1m), JS Date clamps to
// the last valid day (Feb 28/29), exactly the behaviour we want.
function addCalendarMonth(d: Date): Date {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  return next;
}

export function calcBookingPrice({ startDate, endDate, dailyRateLkr, monthlyRateLkr }: PriceInputs): PriceBreakdown {
  const start = parseUTC(startDate);
  const end   = parseUTC(endDate);
  const totalDays = daysBetweenUTC(start, end);

  if (totalDays <= 0) {
    return { fullMonths: 0, remainingDays: 0, monthsCost: 0, daysCost: 0, subtotal: 0 };
  }

  // No monthly rate configured, straight daily math.
  if (!monthlyRateLkr) {
    return {
      fullMonths: 0,
      remainingDays: totalDays,
      monthsCost: 0,
      daysCost: totalDays * dailyRateLkr,
      subtotal: totalDays * dailyRateLkr,
    };
  }

  // Walk forward in calendar months from start_date. Each step that lands at
  // or before end_date is a full chargeable month.
  let cursor     = start;
  let fullMonths = 0;
  while (true) {
    const next = addCalendarMonth(cursor);
    if (next.getTime() > end.getTime()) break;
    cursor = next;
    fullMonths += 1;
  }

  const remainingDays = daysBetweenUTC(cursor, end);
  const monthsCost    = fullMonths * monthlyRateLkr;
  const daysCost      = remainingDays * dailyRateLkr;

  return {
    fullMonths,
    remainingDays,
    monthsCost,
    daysCost,
    subtotal: monthsCost + daysCost,
  };
}

// Convenience for callers that only have a day count and don't care about
// calendar accuracy (e.g. UI estimations before dates are picked).
export function calcBookingPriceByDays(
  days: number,
  dailyRateLkr: number,
  monthlyRateLkr: number | null | undefined,
): PriceBreakdown {
  if (days <= 0) {
    return { fullMonths: 0, remainingDays: 0, monthsCost: 0, daysCost: 0, subtotal: 0 };
  }
  if (monthlyRateLkr && days >= 30) {
    const fullMonths    = Math.floor(days / 30);
    const remainingDays = days - fullMonths * 30;
    return {
      fullMonths,
      remainingDays,
      monthsCost: fullMonths * monthlyRateLkr,
      daysCost:   remainingDays * dailyRateLkr,
      subtotal:   fullMonths * monthlyRateLkr + remainingDays * dailyRateLkr,
    };
  }
  return {
    fullMonths: 0,
    remainingDays: days,
    monthsCost: 0,
    daysCost: days * dailyRateLkr,
    subtotal: days * dailyRateLkr,
  };
}
