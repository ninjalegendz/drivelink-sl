// Booking subtotal calculation, shared between the API and the booking form.
//
// Weekly and 30-day rates are used only when they produce a lower total than
// smaller units, so a badly configured discount cannot overcharge a renter.

export interface PriceBreakdown {
  fullMonths:    number;
  fullWeeks:     number;
  remainingDays: number;
  monthsCost:    number;
  weeksCost:     number;
  daysCost:      number;
  subtotal:      number;
}

export interface PriceInputs {
  startDate:      string;  // YYYY-MM-DD
  endDate:        string;  // YYYY-MM-DD (exclusive, return day)
  dailyRateLkr:   number;
  weeklyRateLkr?: number | null;
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

export function calcBookingPrice({ startDate, endDate, dailyRateLkr, weeklyRateLkr, monthlyRateLkr }: PriceInputs): PriceBreakdown {
  const start = parseUTC(startDate);
  const end   = parseUTC(endDate);
  const totalDays = daysBetweenUTC(start, end);

  if (totalDays <= 0) {
    return { fullMonths: 0, fullWeeks: 0, remainingDays: 0, monthsCost: 0, weeksCost: 0, daysCost: 0, subtotal: 0 };
  }

  return calcBookingPriceByDays(totalDays, dailyRateLkr, monthlyRateLkr, weeklyRateLkr);
}

// Dynamic programming chooses the cheapest exact combination of day, week,
// and 30-day units. It never charges a 7-day unit for a shorter rental.
export function calcBookingPriceByDays(
  days: number,
  dailyRateLkr: number,
  monthlyRateLkr: number | null | undefined,
  weeklyRateLkr?: number | null,
): PriceBreakdown {
  if (days <= 0) {
    return { fullMonths: 0, fullWeeks: 0, remainingDays: 0, monthsCost: 0, weeksCost: 0, daysCost: 0, subtotal: 0 };
  }

  type State = { cost: number; months: number; weeks: number; dayUnits: number };
  const best: State[] = [{ cost: 0, months: 0, weeks: 0, dayUnits: 0 }];
  for (let day = 1; day <= days; day += 1) {
    let state: State = { ...best[day - 1], cost: best[day - 1].cost + dailyRateLkr, dayUnits: best[day - 1].dayUnits + 1 };
    if (weeklyRateLkr && day >= 7) {
      const prior = best[day - 7];
      const candidate = { ...prior, cost: prior.cost + weeklyRateLkr, weeks: prior.weeks + 1 };
      if (candidate.cost < state.cost) state = candidate;
    }
    if (monthlyRateLkr && day >= 30) {
      const prior = best[day - 30];
      const candidate = { ...prior, cost: prior.cost + monthlyRateLkr, months: prior.months + 1 };
      if (candidate.cost < state.cost) state = candidate;
    }
    best.push(state);
  }

  const result = best[days];
  return {
    fullMonths: result.months,
    fullWeeks: result.weeks,
    remainingDays: result.dayUnits,
    monthsCost: result.months * (monthlyRateLkr ?? 0),
    weeksCost: result.weeks * (weeklyRateLkr ?? 0),
    daysCost: result.dayUnits * dailyRateLkr,
    subtotal: result.cost,
  };
}
