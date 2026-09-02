"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, X } from "lucide-react";
import type { BookingStatus } from "@/types/database";

interface Props {
  bookingId: string;
  status: BookingStatus;
}

type Target = "confirmed" | "declined" | "cancelled";

const LABEL: Record<Target, string> = {
  confirmed: "Confirm",
  declined: "Decline",
  cancelled: "Cancel",
};

export function AdminBookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(to: Target) {
    if (!confirm(
      `${LABEL[to]} this booking on behalf of the Rental Page?\n\n` +
      "Use this only after speaking to the Rental Page. The action is recorded in the booking history.",
    )) return;

    setLoading(to);
    setError(null);
    const response = await fetch("/api/admin/bookings/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, to }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setLoading(null);
    if (!response.ok) return setError(payload.error ?? "Action failed.");
    router.refresh();
  }

  const targets: Target[] = status === "pending_confirmation"
    ? ["confirmed", "declined"]
    : status === "confirmed"
      ? ["cancelled"]
      : [];
  if (targets.length === 0) return null;

  const icons: Record<Target, React.ReactNode> = {
    confirmed: <Check size={12} />,
    declined: <X size={12} />,
    cancelled: <Ban size={12} />,
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1">
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => transition(target)}
            disabled={loading !== null}
            className={`spring-press inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${target === "confirmed" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"}`}
          >
            {icons[target]} {loading === target ? "Working..." : LABEL[target]}
          </button>
        ))}
      </div>
      {error && <p className="max-w-[160px] text-xs text-red-700">{error}</p>}
    </div>
  );
}
