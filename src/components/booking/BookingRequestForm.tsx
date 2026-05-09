"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { formatLKR } from "@/lib/vehicles/format";

interface Props {
  vehicleId: string;
  agencyId: string;
  dailyRateLkr: number;
}

export function BookingRequestForm({ vehicleId, agencyId, dailyRateLkr }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const days =
    startDate && endDate
      ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 0;

  const subtotal = days * dailyRateLkr;

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
    if (days > 30) {
      setError("Maximum booking length is 30 days.");
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
        vehicle_id:     vehicleId,
        agency_id:      agencyId,
        start_date:     startDate,
        end_date:       endDate,
        daily_rate_lkr: dailyRateLkr,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Failed to send request. Please try again.");
      return;
    }

    const { bookingId } = await res.json();
    router.push(`/bookings/${bookingId}`);
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

      {/* Price breakdown */}
      {days > 0 && (
        <div className="bg-slate-800 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>{formatLKR(dailyRateLkr)} × {days} day{days !== 1 ? "s" : ""}</span>
            <span>{formatLKR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Booking lock-in fee</span>
            <span>Rs. 1,000</span>
          </div>
          <div className="flex justify-between text-white font-semibold border-t border-slate-700 pt-1 mt-1">
            <span>Total rental cost</span>
            <span>{formatLKR(subtotal)}</span>
          </div>
          <p className="text-slate-500 text-xs">
            Rs. 1,000 due now (if confirmed). Balance paid to agency on collection.
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Request this car — free
      </Button>

      <p className="text-slate-500 text-xs text-center">
        No payment until the agency confirms availability.
      </p>
    </form>
  );
}
