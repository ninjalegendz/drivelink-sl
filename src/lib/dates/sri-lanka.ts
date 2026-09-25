const SRI_LANKA_TIME_ZONE = "Asia/Colombo";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SRI_LANKA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns today's calendar date for the place DriveLink serves, not UTC. */
export function sriLankaToday(): string {
  const parts = dateFormatter.formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * bookings.start_at and end_at hold a plain Sri Lanka clock time with no time
 * zone (migration 041). Parsed as-is, JavaScript reads that as the runtime's
 * own zone: UTC on the server, which lands 5.5 hours late. Sri Lanka has no
 * daylight saving, so a fixed +05:30 gives the real moment.
 */
export function sriLankaClockToInstant(value: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value.replace(" ", "T")}+05:30`);
}

const clockFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SRI_LANKA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * The current Sri Lanka clock time as "YYYY-MM-DDTHH:MM:SS", for comparing
 * against start_at / end_at in a query. A UTC ISO string there would lose its
 * zone in the cast and be compared 5.5 hours out.
 */
export function sriLankaClockNow(): string {
  const parts = clockFormatter.formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function addCalendarDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Search only accepts a complete, real range that could progress to booking. */
export function isValidSearchDateRange(from: string, to: string): boolean {
  return isRealIsoDate(from)
    && isRealIsoDate(to)
    && from >= addCalendarDays(sriLankaToday(), 1)
    && to > from;
}
