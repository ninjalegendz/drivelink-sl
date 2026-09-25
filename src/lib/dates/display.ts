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

// ─── Moments (timestamps such as created_at) ────────────────
// Unlike booking dates, these are real instants stored in UTC. Slicing the
// ISO string gives the UTC day, which is the wrong day for anything after
// 18:30 UTC (midnight in Sri Lanka), so they are converted to Colombo time.

const SRI_LANKA = "Asia/Colombo";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SRI_LANKA, year: "numeric", month: "2-digit", day: "2-digit" });
const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: SRI_LANKA, hour: "numeric", minute: "2-digit", hour12: true });

/** "2026-10-01T20:15:00Z" as its Sri Lanka calendar day, "2026-10-02". */
export function sriLankaDayKey(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : dayKeyFormat.format(date);
}

/** A moment as its Sri Lanka day, "Fri 2 Oct". */
export function formatInstantDay(iso: string): string {
  return formatDay(sriLankaDayKey(iso));
}

/** A moment as Sri Lanka clock time, "1:45 AM". */
export function formatInstantClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : clockFormat.format(date);
}
