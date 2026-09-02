"use client";

import { ExternalLink, PlayCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { trackTrafficEvent } from "@/lib/analytics/client";

interface Props {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  duration: string;
  youtubeUrl: string;
  variant?: "callout" | "panel";
}

const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";

function videoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "embed") return parts[1] ?? null;
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export function TutorialWatchButton({ slug, title, shortTitle, description, duration, youtubeUrl, variant = "callout" }: Props) {
  const [open, setOpen] = useState(false);
  const [resumeAt, setResumeAt] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const videoId = videoIdFromUrl(youtubeUrl);
  const storageKey = `drivelink-guide-progress:${slug}`;
  const playerOrigin = typeof window === "undefined" ? "https://drivelink.lk" : window.location.origin;

  function readProgress() {
    try {
      const stored = Number(window.localStorage.getItem(storageKey) ?? "0");
      return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
    } catch {
      return 0;
    }
  }

  function showPlayer() {
    const saved = readProgress();
    setResumeAt(saved);
    setCurrentTime(saved);
    setOpen(true);
    trackTrafficEvent({ event: "guide_opened", entityType: "guide", entityId: slug, label: title });
  }

  function persistProgress(value = currentTime) {
    if (value <= 2) return;
    try {
      window.localStorage.setItem(storageKey, String(Math.floor(value)));
    } catch {
      // The guide remains usable when private browsing blocks storage.
    }
  }

  function closePlayer() {
    persistProgress();
    setOpen(false);
  }

  function restart() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // The player can still restart without persistent storage.
    }
    setResumeAt(0);
    setCurrentTime(0);
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [0, true] }), YOUTUBE_ORIGIN);
  }

  useEffect(() => {
    setResumeAt(readProgress());
    // Each guide owns a separate local resume point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePlayer();
      if (event.key !== "Tab") return;
      const dialog = closeRef.current?.closest<HTMLElement>("[role=dialog]");
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== YOUTUBE_ORIGIN && event.origin !== "https://www.youtube.com") return;
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const value = payload?.info?.currentTime;
        if (typeof value === "number" && Number.isFinite(value)) {
          setCurrentTime(value);
          persistProgress(value);
        }
      } catch {
        // Ignore unrelated window messages.
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: slug }), YOUTUBE_ORIGIN);
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), YOUTUBE_ORIGIN);
    }, 1_000);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
      returnFocus?.focus();
    };
    // The modal lifetime intentionally owns the player listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  const button = variant === "panel" ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={showPlayer}
      className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
    >
      <PlayCircle size={17} /> {resumeAt > 2 ? "Continue guide" : "Watch guide"}
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={showPlayer}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
    >
      <PlayCircle size={16} /> Watch
    </button>
  );

  return (
    <>
      {button}
      {open && videoId && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closePlayer(); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 text-white sm:h-auto sm:max-h-[94dvh] sm:max-w-md sm:rounded-lg sm:border sm:border-white/15"
          >
            <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4 pt-[env(safe-area-inset-top)]">
              <div className="min-w-0 py-3">
                <p className="text-xs font-medium text-slate-400">{duration} video guide</p>
                <h2 id={titleId} className="truncate text-sm font-semibold text-white">{shortTitle}</h2>
              </div>
              <button ref={closeRef} type="button" onClick={closePlayer} className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close video guide">
                <X size={20} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
              <iframe
                ref={iframeRef}
                key={`${videoId}-${resumeAt}`}
                src={`${YOUTUBE_ORIGIN}/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(playerOrigin)}&playsinline=1&rel=0&start=${resumeAt}&autoplay=1`}
                title={title}
                className="aspect-[9/16] max-h-full w-full max-w-[calc(100dvh*9/16)]"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>

            <footer className="border-t border-white/10 bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <p className="line-clamp-2 text-xs leading-5 text-slate-400">{description}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button type="button" onClick={restart} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white">
                  <RotateCcw size={14} /> Start over
                </button>
                <a href={youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white">
                  YouTube <ExternalLink size={13} />
                </a>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
