"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, ExternalLink } from "lucide-react";
import { createClient, realtimeReady } from "@/lib/supabase/client";

interface Props {
  agencyId?: string;
  viewHref:  string;
}

interface ToastBooking {
  id:         string;
  start_date: string;
  end_date:   string;
}

/**
 * Realtime subscription to bookings INSERTs. Pure visual notifier:
 * ding + top-of-screen banner + OS notification. Lists subscribe to
 * realtime themselves and update surgically (see useBookingsRealtime),
 * so this component never calls router.refresh, that would unmount the
 * banner and nuke any in-progress form/upload on the page.
 *
 * RLS gates the underlying SELECT, so agency subscribers only get their
 * own rows; admin gets all (no filter).
 */
export function BookingNotifier({ agencyId, viewHref }: Props) {
  const [toasts, setToasts] = useState<ToastBooking[]>([]);

  // OS notification permission, asked once
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

  // Synthesised two-tone ding via Web Audio
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
      tone(880, 0,    0.18);
      tone(1320, 0.12, 0.22);
    } catch { /* autoplay blocked, silent fail */ }
  }

  useEffect(() => {
    const supabase = createClient();
    const channelName = agencyId ? `bookings-agency-${agencyId}` : "bookings-all";
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void realtimeReady().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          agencyId
            ? { event: "INSERT", schema: "public", table: "bookings", filter: `agency_id=eq.${agencyId}` }
            : { event: "INSERT", schema: "public", table: "bookings" },
          (payload) => {
            const row = payload.new as { id: string; start_date: string; end_date: string };
            handleNewBooking(row);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };

    function handleNewBooking(row: ToastBooking) {
      console.log("[BookingNotifier] handleNewBooking", row);
      playDing();

      if (permission === "granted" && typeof document !== "undefined" && document.hidden) {
        try {
          const notif = new Notification("New booking request", {
            body: `${row.start_date} → ${row.end_date}`,
            icon: "/icon-192.png",
            tag:  row.id,
          });
          notif.onclick = () => { window.focus(); window.location.href = viewHref; notif.close(); };
        } catch { /* non-fatal */ }
      }

      const toast = { ...row };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 30_000);
    }
  }, [agencyId, viewHref, permission]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-[60] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-blue-600 border-2 border-blue-600 rounded-2xl shadow-2xl p-4 animate-bounce-in ring-4 ring-blue-500/30"
        >
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-full bg-stone-900 text-blue-500 flex items-center justify-center shrink-0 animate-pulse">
              <Bell size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 font-bold text-base">New booking request</p>
              <p className="text-slate-900 text-sm mt-0.5">{t.start_date} → {t.end_date}</p>
              <a
                href={viewHref}
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-blue-500 rounded-lg text-xs font-semibold transition-colors"
              >
                Open booking <ExternalLink size={12} />
              </a>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-slate-900 hover:text-slate-900 shrink-0"
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
