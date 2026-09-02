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
