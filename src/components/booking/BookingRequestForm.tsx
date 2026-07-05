"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { formatLKR } from "@/lib/vehicles/format";
import { usdFromLkr } from "@/data/vehicles";
import { siteConfig, whatsappLink } from "@/lib/site-config";
import { calcBookingPriceByDays, billableDaysBetween, toDateTime } from "@/lib/bookings/pricing";
import { GuestBookingModal } from "@/components/booking/GuestBookingModal";

export interface DateRange {
  start: string;  // ISO datetime "YYYY-MM-DDTHH:mm[:ss]"
  end:   string;
}

interface Props {
  vehicleId:      string;
  agencyId:       string;
  vehicleName:    string;
  dailyRateLkr:   number;
  monthlyRateLkr?: number | null;
  bookedRanges?:  DateRange[];
  /** Path to this listing (e.g. "/vehicles/aqua-2019"). Embedded into the
   *  pre-filled WhatsApp links so support can open the exact post even when
   *  two vehicles share the same title. */
  listingPath?:   string;
}

// Half-open overlap on the combined datetimes: [a,b) overlaps [c,d) iff
// a < d AND c < b. Compared as timestamps so date-only and date+time mix.
function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return new Date(a.start).getTime() < new Date(b.end).getTime()
      && new Date(b.start).getTime() < new Date(a.end).getTime();
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  const s = new Date(start).toLocaleString("en-LK", opts);
  const e = new Date(end).toLocaleString("en-LK", opts);
  return `${s} → ${e}`;
}

// ── Time-selector helpers ──
const LEAD_HOURS = 24; // bookings must start at least this many hours from now
const PAD = (n: number) => String(n).padStart(2, "0");
const localDateStr = (d: Date) => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
const localTimeStr = (d: Date) => `${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
const roundUpTo30 = (ms: number) => new Date(Math.ceil(ms / 1_800_000) * 1_800_000);
// 48 half-hour slots of a day as "HH:mm" (00:00, 00:30, … 23:30).
const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => `${PAD(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${PAD(m)} ${period}`;
}

export function BookingRequestForm({ vehicleId, agencyId, vehicleName, dailyRateLkr, monthlyRateLkr, bookedRanges = [], listingPath }: Props) {
  // Full listing URL for the pre-filled WhatsApp links, lets support open the
  // exact post (the vehicle name alone isn't unique).
  const listingUrl = listingPath ? `${siteConfig.appUrl}${listingPath}` : "";
  const router = useRouter();

  // Earliest non-past slot (rounded to next 30 min) + today's date. The picker
  // lets people choose from now onward, so a too-soon booking is *reachable* -
  // we surface the 24h rule with a banner + disabled submit, not by hiding slots.
  const nowFloor     = roundUpTo30(Date.now());
  const today        = localDateStr(nowFloor);
  const nowFloorTime = localTimeStr(nowFloor);

  // 24-hour lead-time boundary: pick-up must be at/after this. Also the smart
  // default, so the form opens on a valid time (no banner) yet allows sooner.
  const leadCutoff   = roundUpTo30(Date.now() + LEAD_HOURS * 3_600_000);
  const defaultDate  = localDateStr(leadCutoff);
  const defaultTime  = localTimeStr(leadCutoff);
  const defaultEnd   = localDateStr(new Date(leadCutoff.getTime() + 86_400_000));

  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate]     = useState(defaultEnd);
  const [startTime, setStartTime] = useState(defaultTime);
  const [endTime, setEndTime]     = useState(defaultTime);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [guestModal, setGuestModal] = useState(false);

  const dtClass = "w-full min-w-0 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500";

  // Pick-up: no past slots on today; all slots on later dates. Return offers all
  // slots, "after pick-up" is enforced by the days >= 1 check on submit.
  const startTimeOpts = startDate === today ? HALF_HOUR_SLOTS.filter((t) => t >= nowFloorTime) : HALF_HOUR_SLOTS;
  const endTimeOpts   = HALF_HOUR_SLOTS;

  function onStartDateChange(v: string) {
    setStartDate(v);
    if (v === today && startTime < nowFloorTime) setStartTime(nowFloorTime);
    if (endDate < v) setEndDate(v);
  }

  const startAt = startDate ? toDateTime(startDate, startTime) : "";
  const endAt   = endDate   ? toDateTime(endDate, endTime)     : "";

  // Chosen pick-up sooner than the 24h lead time → show the urgent banner + block.
  const within24h = !!startAt && new Date(startAt).getTime() < leadCutoff.getTime();

  // Strict 24-hour billable days, matches the DB + API exactly.
  const days = startAt && endAt ? billableDaysBetween(startAt, endAt) : 0;

  const price = days > 0
    ? calcBookingPriceByDays(days, dailyRateLkr, monthlyRateLkr)
    : { fullMonths: 0, remainingDays: 0, monthsCost: 0, daysCost: 0, subtotal: 0 };
  const undiscountedTotal = days * dailyRateLkr;
  const savings = undiscountedTotal - price.subtotal;

  // Live conflict check while the user picks dates/times
  const conflict =
    startAt && endAt && days >= 1
      ? bookedRanges.find((r) => rangesOverlap({ start: startAt, end: endAt }, r))
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select pick-up and return dates.");
      return;
    }
    if (days < 1) {
      setError("Return must be after pick-up.");
      return;
    }
    if (days > 365) {
      setError("Maximum rental length is 365 days.");
      return;
    }
    if (conflict) {
      setError(`Those dates overlap with an existing booking (${formatRange(conflict.start, conflict.end)}). Pick different dates.`);
      return;
    }
    if (new Date(startAt).getTime() < leadCutoff.getTime()) {
      setError(`Pick-up must be at least ${LEAD_HOURS} hours from now. For an urgent booking, message us on WhatsApp.`);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest path, open the inline signup/login modal instead of bouncing
      // them to /login. Booking gets placed by the modal once they're in.
      setLoading(false);
      setGuestModal(true);
      return;
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        agency_id:  agencyId,
        start_date: startDate,
        end_date:   endDate,
        start_time: startTime,
        end_time:   endTime,
      }),
    });

    setLoading(false);

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorCode = (payload as { code?: string }).code;
      if (errorCode === "kyc_required") {
        // Punt to account page so the renter can start verification.
        // The /account?next=... param lets us bring them back here later.
        router.push(`/account?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setError(payload.error ?? "Failed to send request. Please try again.");
      return;
    }

    router.push(`/bookings/${payload.bookingId}`);
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        {/* Date gets more room than time so neither field is cramped on a phone */}
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <div className="min-w-0">
            <label className="text-slate-600 text-xs mb-1 block">Pick-up date</label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => onStartDateChange(e.target.value)}
              className={dtClass}
              required
            />
          </div>
          <div className="min-w-0">
            <label className="text-slate-600 text-xs mb-1 block">Pick-up time</label>
            <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className={dtClass} required>
              {startTimeOpts.map((t) => <option key={t} value={t}>{to12h(t)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <div className="min-w-0">
            <label className="text-slate-600 text-xs mb-1 block">Return date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              className={dtClass}
              required
            />
          </div>
          <div className="min-w-0">
            <label className="text-slate-600 text-xs mb-1 block">Return time</label>
            <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className={dtClass} required>
              {endTimeOpts.map((t) => <option key={t} value={t}>{to12h(t)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <p className="text-slate-400 text-[11px] -mt-1">Billed in 24-hour blocks, a later return time can add a day.</p>

      {/* Shown only when the chosen pick-up is under 24h away */}
      {within24h && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <WhatsAppIcon size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-amber-800 text-[11px] leading-relaxed">
            That pick-up is under 24 hours away, online bookings need at least {LEAD_HOURS} hours&apos; notice.
            Need it sooner?{" "}
            <a
              href={whatsappLink(`Hi DriveLink, I'd like an urgent booking for the ${vehicleName}.${listingUrl ? ` Listing: ${listingUrl}` : ""}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              WhatsApp {siteConfig.whatsappDisplay}
            </a>.
          </p>
        </div>
      )}

      {/* Already-booked ranges */}
      {bookedRanges.length > 0 && (
        <div className="bg-slate-100 rounded-lg p-3">
          <p className="text-slate-600 text-xs font-medium mb-1.5">Unavailable dates</p>
          <ul className="space-y-0.5">
            {bookedRanges.map((r) => (
              <li key={`${r.start}-${r.end}`} className="text-slate-500 text-xs">
                {formatRange(r.start, r.end)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live conflict warning */}
      {conflict && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">
            Your selected dates overlap with {formatRange(conflict.start, conflict.end)}.
          </p>
        </div>
      )}

      {/* Price breakdown */}
      {days > 0 && !conflict && (
        <div className="bg-slate-100 rounded-lg p-3 space-y-1 text-sm">
          {price.fullMonths > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>
                {formatLKR(monthlyRateLkr ?? 0)} × {price.fullMonths} month{price.fullMonths !== 1 ? "s" : ""}
              </span>
              <span>{formatLKR(price.monthsCost)}</span>
            </div>
          )}
          {price.remainingDays > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>{formatLKR(dailyRateLkr)} × {price.remainingDays} day{price.remainingDays !== 1 ? "s" : ""}</span>
              <span>{formatLKR(price.daysCost)}</span>
            </div>
          )}
          {savings > 0 && (
            <div className="flex justify-between text-emerald-400 text-xs">
              <span>Monthly-rate discount</span>
              <span>−{formatLKR(savings)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-900 font-semibold border-t border-slate-200 pt-1 mt-1">
            <span>Total rental cost</span>
            <span>
              {formatLKR(price.subtotal)}
              {siteConfig.showUsd && (
                <span className="text-slate-400 font-normal text-xs ml-1">~${usdFromLkr(price.subtotal)}</span>
              )}
            </span>
          </div>
          <p className="text-blue-700 text-xs font-medium">
            {siteConfig.freeLaunch ? "No booking fee. " : ""}You arrange payment directly with the provider on handover.
          </p>
        </div>
      )}

      {error && !conflict && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <Button
        type="submit"
        loading={loading}
        disabled={!!conflict || within24h}
        className="w-full"
        size="lg"
      >
        Send booking request{siteConfig.freeLaunch ? ", free" : ""}
      </Button>

      <p className="text-slate-500 text-xs text-center">
        No payment to DriveLink. The provider confirms availability first.
      </p>

      {/* Lowest-friction path, ask on WhatsApp with the details pre-filled. */}
      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] text-slate-400 font-semibold uppercase">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <a
        href={whatsappLink(
          `Hi DriveLink, I'd like to rent the ${vehicleName}.` +
          (days > 0 ? ` Dates: ${startDate} ${startTime} → ${endDate} ${endTime} (${days} day${days === 1 ? "" : "s"}).` : "") +
          (listingUrl ? ` Listing: ${listingUrl}` : "")
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
      >
        <WhatsAppIcon size={16} /> Ask on WhatsApp
      </a>
    </form>

    {/* Modal renders OUTSIDE the booking form. Nested <form> tags are
        invalid HTML, browsers hoist the inner one out, which made the
        modal's "Send code" button submit the booking form instead. */}
    {guestModal && days > 0 && (
      <GuestBookingModal
        draft={{
          vehicleId,
          agencyId,
          vehicleName,
          startDate,
          endDate,
          startTime,
          endTime,
          totalDays: days,
          subtotal:  price.subtotal,
        }}
        onClose={() => setGuestModal(false)}
      />
    )}
    </>
  );
}
