// Human dates for screens. Booking dates are stored as calendar days
// ("2026-10-02") with a separate clock time ("09:00:00"), not as instants, so
// they are formatted in UTC: formatting in the reader's own timezone would
// shift the day for anyone outside Sri Lanka.

/** "2026-10-02" as "Fri 2 Oct". */
export function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  // Assembled from parts: en-GB alone writes September as "Sept".
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/** "09:00:00" as "9:00 AM". */
export function formatClock(time: string): string {
  const [h, min] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return time;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "2026-10-02" + "09:00:00" as "Fri 2 Oct, 9:00 AM". */
export function formatSlot(date: string, time?: string | null): string {
  return time ? `${formatDay(date)}, ${formatClock(time)}` : formatDay(date);
}
