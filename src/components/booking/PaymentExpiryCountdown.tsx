"use client";

import { useEffect, useState } from "react";
import { Timer, AlertTriangle } from "lucide-react";

interface Props {
  confirmedAt: string; // ISO
  windowHours?: number; // default 12
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  const s = Math.floor(ms / 1000);
  return `${s}s`;
}

export function PaymentExpiryCountdown({ confirmedAt, windowHours = 12 }: Props) {
  const expiresAtMs = new Date(confirmedAt).getTime() + windowHours * 3600_000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000); // tick every 30s, minute-precision is fine
    return () => clearInterval(id);
  }, []);

  const remaining = expiresAtMs - now;
  const urgent    = remaining > 0 && remaining < 2 * 3600_000; // <2h
  const expired   = remaining <= 0;

  const tone = expired
    ? "bg-red-500/10 border-red-500/20 text-red-300"
    : urgent
    ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
    : "bg-slate-100 border-slate-200/60 text-slate-700";

  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${tone}`}>
      {urgent || expired
        ? <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        : <Timer        size={16} className="shrink-0 mt-0.5" />}
      <div className="flex-1">
        <p className="font-medium">
          {expired
            ? "Payment window expired, cancellation pending"
            : `Auto-cancels in ${formatRemaining(remaining)}`}
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          {expired
            ? "We'll process this shortly. You'll get an SMS + email when it cancels."
            : `Upload the bank slip before ${new Date(expiresAtMs).toLocaleString("en-LK", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} or this booking will be cancelled. Repeated unpaid confirmations hurt your reliability score.`}
        </p>
      </div>
    </div>
  );
}
