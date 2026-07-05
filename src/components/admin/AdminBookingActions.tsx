"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CheckCheck, Ban } from "lucide-react";
import type { BookingStatus } from "@/types/database";

interface Props {
  bookingId: string;
  status:    BookingStatus;
}

type Target = "confirmed" | "declined" | "completed" | "cancelled";

const LABEL: Record<Target, string> = {
  confirmed: "Confirm",
  declined:  "Decline",
  completed: "Complete",
  cancelled: "Cancel",
};

/**
 * Admin-side booking actions, used when the admin spoke to the agency
 * by phone and wants to apply the agency's decision themselves. Hits
 * /api/admin/bookings/transition which logs the action to activity_events
 * with event_type="booking.<state>_by_admin" so the audit trail is clear.
 */
export function AdminBookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<Target | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const resolvingDispute = (to: Target) => status === "disputed" && to === "completed";

  async function transition(to: Target) {
    let resolutionNote: string | undefined;

    if (resolvingDispute(to)) {
      const note = window.prompt(
        "Resolution note (required). This resolves the incident report(s), marks the booking completed, " +
        "and is logged in the audit trail. What was decided?"
      );
      if (note === null) return; // cancelled
      const trimmed = note.trim();
      if (trimmed.length < 5) { setError("Resolution note must be at least 5 characters."); return; }
      resolutionNote = trimmed;
    } else if (!confirm(
      `${LABEL[to]} this booking on behalf of the agency?\n\n` +
      "This is for when you've spoken to the agency and they've decided. " +
      "The action is logged as an admin override in the audit trail."
    )) return;

    setLoading(to); setError(null);
    const res = await fetch("/api/admin/bookings/transition", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        bookingId,
        to,
        ...(resolutionNote ? { resolution_note: resolutionNote } : {}),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(null);

    if (!res.ok) {
      setError((payload as { error?: string }).error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  // What transitions make sense from the current state
  const availableTargets: Target[] = (() => {
    switch (status) {
      case "requested":
      case "pending_confirmation": return ["confirmed", "declined"];
      case "confirmed":
      case "payment_pending":      return ["cancelled"];
      case "active":               return ["completed", "cancelled"];
      case "disputed":             return ["completed"];
      default:                     return [];
    }
  })();

  if (availableTargets.length === 0) return null;

  const iconFor: Record<Target, React.ReactNode> = {
    confirmed: <Check  size={12} />,
    declined:  <X      size={12} />,
    completed: <CheckCheck size={12} />,
    cancelled: <Ban    size={12} />,
  };

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex gap-1 flex-wrap">
        {availableTargets.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => transition(t)}
            disabled={loading !== null}
            className={`spring-press inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50 ${
              t === "confirmed"  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" :
              t === "completed"  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" :
                                   "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
            }`}
          >
            {iconFor[t]} {loading === t ? "…" : resolvingDispute(t) ? "Resolve dispute" : LABEL[t]}
          </button>
        ))}
      </div>
      {error && <p className="text-red-400 text-[10px] max-w-[140px]">{error}</p>}
    </div>
  );
}
