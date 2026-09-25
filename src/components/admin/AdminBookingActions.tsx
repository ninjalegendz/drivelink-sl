"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    confirmed: <Check size={13} aria-hidden="true" />,
    declined: <X size={13} aria-hidden="true" />,
    cancelled: <Ban size={13} aria-hidden="true" />,
  };
  const variant: Record<Target, "primary" | "secondary" | "danger"> = {
    confirmed: "primary",
    declined: "danger",
    cancelled: "danger",
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {targets.map((target) => (
          <Button
            key={target}
            type="button"
            size="sm"
            variant={variant[target]}
            loading={loading === target}
            disabled={loading !== null}
            onClick={() => transition(target)}
          >
            {icons[target]} {LABEL[target]}
          </Button>
        ))}
      </div>
      {error && <p className="max-w-[180px] text-xs text-rose-700">{error}</p>}
    </div>
  );
}
