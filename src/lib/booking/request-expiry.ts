/**
 * How long an owner has to answer a booking request.
 *
 * An unanswered request used to stay open forever. The renter waited with no
 * answer, and because a renter may only have four requests open at once, four
 * owners who never replied locked them out of asking anyone else.
 *
 * A request now closes at whichever comes first: 24 hours after it was sent,
 * or the pickup time (a request past its pickup time can no longer be kept).
 * The owner is reminded before that; the renter is told when it closes, and
 * why, so they can book another vehicle.
 *
 * The same rule lives in the database, booking_request_reply_deadline()
 * (migration 132), which the closing job uses. Change both together.
 */
import { sriLankaClockToInstant } from "@/lib/dates/sri-lanka";

export const REQUEST_REPLY_WINDOW_HOURS = 24;

/** Stored on a request the owner never answered. The renter sees this text. */
export const NO_REPLY_REASON = "No reply from the owner in time";

/**
 * When an unanswered request closes. `startAt` is the booking's start_at, a
 * Sri Lanka clock time with no zone, so it is read as Sri Lanka time.
 */
export function requestReplyDeadline(createdAt: string, startAt: string | null): Date {
  const windowEnd = new Date(Date.parse(createdAt) + REQUEST_REPLY_WINDOW_HOURS * 3_600_000);
  if (!startAt) return windowEnd;
  const pickup = sriLankaClockToInstant(startAt);
  return pickup < windowEnd ? pickup : windowEnd;
}

/** "3:00 PM today", "9:30 AM tomorrow" or "Sat 26 Sep, 9:30 AM", in Sri Lanka time. */
export function formatReplyDeadline(deadline: Date, now: Date = new Date()): string {
  const zone = "Asia/Colombo";
  const time = deadline.toLocaleTimeString("en-LK", { timeZone: zone, hour: "numeric", minute: "2-digit" });
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: zone });
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (day(deadline) === day(now)) return `${time} today`;
  if (day(deadline) === day(tomorrow)) return `${time} tomorrow`;
  const date = deadline.toLocaleDateString("en-LK", { timeZone: zone, weekday: "short", day: "numeric", month: "short" });
  return `${date}, ${time}`;
}
