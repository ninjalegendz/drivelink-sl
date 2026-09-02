// How long a Rental Page has to answer a booking request.
//
// A request currently has no expiry anywhere in the system, so a renter can
// wait indefinitely with nothing to interpret except silence — which people
// read as rejection, or as a dead platform, and then go back to WhatsApp.
//
// The deadline is derived from the request's own created_at rather than stored,
// so this needs no schema change and cannot drift out of sync with the row.
//
// Note: nothing here changes a booking's state. Showing the deadline is safe;
// automatically lapsing a real booking is a product decision that belongs to
// the founder, not to a display helper.

const SRI_LANKA_TIME_ZONE = "Asia/Colombo";

/** Hours a Rental Page has to accept or decline before the request is stale. */
export const RESPONSE_WINDOW_HOURS = 24;

export function responseDeadline(createdAt: string): Date {
  return new Date(Date.parse(createdAt) + RESPONSE_WINDOW_HOURS * 3600_000);
}

/** Milliseconds left to respond. Negative once the window has passed. */
export function responseMsRemaining(createdAt: string, now = Date.now()): number {
  return responseDeadline(createdAt).getTime() - now;
}

export function isResponseOverdue(createdAt: string, now = Date.now()): boolean {
  return responseMsRemaining(createdAt, now) <= 0;
}

/** "by 6:30 PM tomorrow" style deadline, always in Sri Lankan time. */
export function formatDeadline(createdAt: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: SRI_LANKA_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(responseDeadline(createdAt));
}

/**
 * Short countdown for a list: "18 hours left", "40 minutes left", "overdue".
 * Deliberately coarse — a ticking clock on a booking creates pressure without
 * adding information.
 */
export function formatTimeLeft(createdAt: string, now = Date.now()): string {
  const remaining = responseMsRemaining(createdAt, now);
  if (remaining <= 0) return "Overdue";

  const hours = Math.floor(remaining / 3600_000);
  if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;

  const minutes = Math.max(1, Math.floor(remaining / 60_000));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
}
