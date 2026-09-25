"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize2, RefreshCw, X } from "lucide-react";
import { Portal, Z } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";

interface Props {
  src: string;
  alt: string;
}
export function WatermarkedImage({ src, alt }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // The retry cache-buster only makes sense for a fetched URL. Appending
  // "&attempt=0" onto a data: URI (a design-preview stand-in image) corrupts
  // its base64 payload instead of busting anything, since there is no cache
  // to bust for content that is already inline.
  const separator = src.includes("?") ? "&" : "?";
  const requestUrl = src.startsWith("data:") ? src : `${src}${separator}attempt=${attempt}`;

  // An instantly-available image (a data URI, as design previews use) can
  // finish loading before React finishes hydrating and attaches onLoad, so
  // the browser's own load event fires with nobody listening and the
  // spinner never clears. Checking .complete/.naturalWidth once the element
  // exists catches that without a second request: a real protected document
  // is watched server-side (no-store, one access-log row per request), so
  // this deliberately never re-fetches the src to double-check it, only
  // reads state the browser already has for the element that is on screen.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, [attempt]);

  function retry() {
    setLoaded(false);
    setFailed(false);
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  // Registers this viewer on the shared overlay stack, so Escape closes only
  // this layer even when it was opened from on top of another sheet/dialog.
  useEscapeLayer(() => setExpanded(false), expanded);

  return (
    <>
      {/* A dark viewing surface, deliberately unlike a normal photo card: this
          is a protected identity document, not a listing photo, and the
          product should never let the two blur together. */}
      <div
        className="relative min-h-64 overflow-hidden rounded-2xl bg-slate-950 shadow-xs ring-1 ring-slate-900/[0.06] select-none"
        onContextMenu={(event) => event.preventDefault()}
      >
        {!loaded && !failed && (
          <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
            <span className="inline-flex items-center gap-2 text-sm text-slate-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
              Loading protected image
            </span>
          </div>
        )}

        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <AlertTriangle size={22} className="mb-2 text-amber-400" />
            <p className="text-sm font-medium text-white">This document could not be displayed.</p>
            <p className="mt-1 text-xs text-slate-400">Access may have ended, or the file may need DriveLink review.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-blue-200"
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : (
          // Protected identity images bypass Next's optimizer so the booking-scoped
          // request and no-store response remain end to end.
          // eslint-disable-next-line @next/next/no-img-element -- protected document requests must bypass the image optimizer.
          <img
            ref={imgRef}
            key={attempt}
            src={requestUrl}
            alt={alt}
            width={1200}
            height={900}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-auto w-full pointer-events-none transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {loaded && !failed && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/70 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-slate-950/90 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label={`Enlarge ${alt}`}
            title="Enlarge image"
          >
            <Maximize2 size={17} />
          </button>
        )}
      </div>

      {/* Full-screen viewers must portal to <body>: a fixed element inside an
          animated or hovered ancestor (this card, a page transition) is only
          "fixed" to that ancestor once it has a transform, so without this the
          lightbox could render trapped behind the surrounding layout. */}
      {expanded && (
        <Portal>
          <div className={`fixed inset-0 ${Z.viewer} flex flex-col bg-slate-950`} role="dialog" aria-modal="true" aria-label={alt}>
            <div className="flex min-h-14 items-center justify-between gap-4 border-b border-white/15 px-4 py-2 text-white">
              <p className="min-w-0 truncate text-sm font-medium">{alt}</p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Close enlarged document"
                title="Close"
              >
                <X size={21} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4" onContextMenu={(event) => event.preventDefault()}>
              {/* eslint-disable-next-line @next/next/no-img-element -- protected document requests must bypass the image optimizer. */}
              <img
                src={requestUrl}
                alt={alt}
                width={1200}
                height={900}
                draggable={false}
                className="mx-auto h-auto max-w-none select-none"
              />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
