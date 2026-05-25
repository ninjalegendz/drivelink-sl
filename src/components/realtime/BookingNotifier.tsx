"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** When set, only fire for bookings on this agency. Omit for admins (sees all). */
  agencyId?: string;
  /** Where the "View" link in the toast points. */
  viewHref:  string;
}

interface ToastBooking {
  id:         string;
  start_date: string;
  end_date:   string;
}

const POLL_INTERVAL_MS = 15_000;

/**
 * Polls for new bookings every ~15 seconds. When a new one is found
 * (created after we mounted), plays a sound + shows a top-of-screen
 * banner + calls router.refresh() so any visible list re-fetches.
 *
 * Originally this used Supabase Realtime, but the broadcast leg was
 * flaky on the free tier — polling is duller but reliable. SMS +
 * WhatsApp from the booking API are the real-time channels; this just
 * keeps the open dashboard tab in sync.
 *
 * Existing RLS gates the SELECT, so agency callers only see their own
 * rows, admins see all.
 */
export function BookingNotifier({ agencyId, viewHref }: Props) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastBooking[]>([]);
  // High-water mark: the most-recent created_at we've already shown a
  // toast for. Initialised to mount time so we don't spam the agent with
  // historical bookings on first poll.
  const sinceRef = useRef<string>(new Date().toISOString());

  // ─── Sound: synthesised two-tone ding via Web Audio ─────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  function playDing() {
    try {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = W.AudioContext ?? W.webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const ctx = audioCtxRef.current;

      function tone(freq: number, startOffset: number, durationSec: number) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + durationSec);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + durationSec + 0.05);
      }
      tone(880, 0,    0.18);   // A5
      tone(1320, 0.12, 0.22);  // E6
    } catch {
      /* autoplay blocked before user interaction — silent fail */
    }
  }

  // ─── OS notification permission (asked once) ────────────────────
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (Notification.permission === "default") {
      Notification.requestPermission().then(setPermission).catch(() => {});
    }
  }, []);

  // ─── Polling loop ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    async function poll() {
      const query = supabase
        .from("bookings")
        .select("id, start_date, end_date, created_at")
        .gt("created_at", sinceRef.current)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data, error } = agencyId
        ? await query.eq("agency_id", agencyId)
        : await query;

      if (error) {
        console.warn("[BookingNotifier] poll error", error.message);
        return;
      }
      if (!data || data.length === 0) return;

      // Walk oldest-first so the toasts stack in arrival order.
      const rows = (data as { id: string; start_date: string; end_date: string; created_at: string }[]).slice().reverse();
      for (const row of rows) {
        handleNewBooking({ id: row.id, start_date: row.start_date, end_date: row.end_date });
      }
      // Advance the high-water mark to the newest row's timestamp.
      sinceRef.current = rows[rows.length - 1].created_at;

      // Refresh the page so the server-rendered list re-fetches and the
      // booking appears without manual F5.
      router.refresh();
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);

    function handleNewBooking(row: ToastBooking) {
      playDing();

      // OS push only when tab is backgrounded
      if (permission === "granted" && typeof document !== "undefined" && document.hidden) {
        try {
          const notif = new Notification("New booking request", {
            body: `${row.start_date} → ${row.end_date}`,
            icon: "/icon-192.png",
            tag:  row.id,
          });
          notif.onclick = () => {
            window.focus();
            router.push(viewHref);
            notif.close();
          };
        } catch { /* non-fatal */ }
      }

      const toast = { ...row };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 30_000);
    }
  }, [agencyId, viewHref, permission, router]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-[60] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-amber-500 border-2 border-amber-600 rounded-2xl shadow-2xl p-4 animate-bounce-in ring-4 ring-amber-500/30"
        >
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-full bg-stone-900 text-amber-300 flex items-center justify-center shrink-0 animate-pulse">
              <Bell size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-stone-900 font-bold text-base">New booking request</p>
              <p className="text-stone-800 text-sm mt-0.5">
                {t.start_date} → {t.end_date}
              </p>
              <a
                href={viewHref}
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Open booking <ExternalLink size={12} />
              </a>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-stone-800 hover:text-stone-900 shrink-0"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
