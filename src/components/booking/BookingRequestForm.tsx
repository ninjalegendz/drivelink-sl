"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { formatLKR } from "@/lib/vehicles/format";
import { calcBookingPrice } from "@/lib/bookings/pricing";

export interface DateRange {
  start: string;  // YYYY-MM-DD
  end:   string;  // YYYY-MM-DD
}

interface Props {
  vehicleId:      string;
  agencyId:       string;
  dailyRateLkr:   number;
  monthlyRateLkr?: number | null;
  bookedRanges?:  DateRange[];
}

// Half-open overlap: [a, b) overlaps [c, d) iff a < d AND c < b.
// Matches the DB constraint and the API pre-check.
function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start).toLocaleDateString("en-LK", opts);
  const e = new Date(end).toLocaleDateString("en-LK", opts);
  return `${s} → ${e}`;
}

export function BookingRequestForm({ vehicleId, agencyId, dailyRateLkr, monthlyRateLkr, bookedRanges = [] }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const days =
    startDate && endDate
      ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 0;

  const price = startDate && endDate && days > 0
    ? calcBookingPrice({ startDate, endDate, dailyRateLkr, monthlyRateLkr })
    : { fullMonths: 0, remainingDays: 0, monthsCost: 0, daysCost: 0, subtotal: 0 };
  const undiscountedTotal = days * dailyRateLkr;
  const savings = undiscountedTotal - price.subtotal;

  // Live conflict check while the user picks dates
  const conflict =
    startDate && endDate && days >= 1
      ? bookedRanges.find((r) => rangesOverlap({ start: startDate, end: endDate }, r))
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select start and end dates.");
      return;
    }
    if (days < 1) {
      setError("End date must be after start date.");
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

    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
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
      }),
    });

    setLoading(false);

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload.error ?? "Failed to send request. Please try again.");
      return;
    }

    router.push(`/bookings/${payload.bookingId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Pick-up date</label>
          <input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            required
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Return date</label>
          <input
            type="date"
            value={endDate}
            min={startDate || today}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            required
          />
        </div>
      </div>

      {/* Already-booked ranges */}
      {bookedRanges.length > 0 && (
        <div className="bg-slate-800/60 rounded-lg p-3">
          <p className="text-slate-400 text-xs font-medium mb-1.5">Unavailable dates</p>
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
        <div className="bg-slate-800 rounded-lg p-3 space-y-1 text-sm">
          {price.fullMonths > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>
                {formatLKR(monthlyRateLkr ?? 0)} × {price.fullMonths} month{price.fullMonths !== 1 ? "s" : ""}
              </span>
              <span>{formatLKR(price.monthsCost)}</span>
            </div>
          )}
          {price.remainingDays > 0 && (
            <div className="flex justify-between text-slate-400">
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
          <div className="flex justify-between text-slate-400">
            <span>Booking lock-in fee</span>
            <span>Rs. 1,000</span>
          </div>
          <div className="flex justify-between text-white font-semibold border-t border-slate-700 pt-1 mt-1">
            <span>Total rental cost</span>
            <span>{formatLKR(price.subtotal)}</span>
          </div>
          <p className="text-slate-500 text-xs">
            Rs. 1,000 due now (if confirmed). Balance paid to agency on collection.
          </p>
        </div>
      )}

      {error && !conflict && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <Button
        type="submit"
        loading={loading}
        disabled={!!conflict}
        className="w-full"
        size="lg"
      >
        Request this car — free
      </Button>

      <p className="text-slate-500 text-xs text-center">
        No payment until the agency confirms availability.
      </p>
    </form>
  );
}
