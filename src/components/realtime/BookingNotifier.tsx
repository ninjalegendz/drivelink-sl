"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** When set, only fire for bookings on this agency. Omit for admins (sees all). */
  agencyId?: string;
  /** Where the "View" link in the toast points. /dashboard/bookings or /admin/bookings. */
  viewHref:  string;
}

interface ToastBooking {
  id:         string;
  start_date: string;
  end_date:   string;
  createdAt:  number;
}

/**
 * Mount once at the top of the dashboard or admin shell. Subscribes to
 * INSERT events on the bookings table via Supabase Realtime and, when
 * one lands, plays a sound + shows an in-app toast + (if granted)
 * fires an OS-level notification.
 *
 * Existing RLS gates the SELECT, so subscribers only receive rows they
 * could read normally — agencies see their own, admins see all.
 */
export function BookingNotifier({ agencyId, viewHref }: Props) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastBooking[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  // Ask for OS-level notification permission once on mount. Browser
  // remembers the choice; no annoying repeat prompts.
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

  // Synthesise a two-tone "ding" using the Web Audio API. No asset file
  // needed; works on every modern browser. AudioContext is lazily
  // created on first call because Chrome blocks construction before any
  // user gesture in some contexts.
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
      // Autoplay blocked before user interaction — silent fail, toast still shows.
    }
  }

  useEffect(() => {
    const supabase = createClient();
    const channelName = agencyId ? `bookings-agency-${agencyId}` : "bookings-all";

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        agencyId
          ? { event: "INSERT", schema: "public", table: "bookings", filter: `agency_id=eq.${agencyId}` }
          : { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          const row = payload.new as { id: string; start_date: string; end_date: string };
          handleNewBooking(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

    function handleNewBooking(row: { id: string; start_date: string; end_date: string }) {
      // 1. Sound
      playDing();

      // 2. Refresh the current page's server-rendered data so any list/
      //    table on screen (admin/bookings, dashboard/bookings) re-fetches
      //    and shows the new booking without the user having to F5.
      router.refresh();

      // 3. OS-level notification (only if the tab isn't focused; otherwise
      //    the in-app toast is enough)
      if (permission === "granted" && typeof document !== "undefined" && document.hidden) {
        try {
          const notif = new Notification("New booking request", {
            body: `${row.start_date} → ${row.end_date}`,
            icon: "/icon-192.png",
            tag:  row.id, // dedupes if Realtime double-fires
          });
          notif.onclick = () => {
            window.focus();
            router.push(`${viewHref}`);
            notif.close();
          };
        } catch {
          // Some browsers throw when Notification is constructed in
          // service-worker-only contexts — non-fatal.
        }
      }

      // 4. In-app toast. Sticks around for 30s so the agent has time to
      //    actually notice it; manual dismiss button always works.
      const toast: ToastBooking = { ...row, createdAt: Date.now() };
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
