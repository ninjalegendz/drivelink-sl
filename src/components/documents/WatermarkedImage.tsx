"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Maximize2, RefreshCw, X } from "lucide-react";

interface Props {
  src: string;
  alt: string;
}
export function WatermarkedImage({ src, alt }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const separator = src.includes("?") ? "&" : "?";
  const requestUrl = `${src}${separator}attempt=${attempt}`;

  function retry() {
    setLoaded(false);
    setFailed(false);
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  return (
    <>
      <div
        className="relative min-h-64 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 select-none"
        onContextMenu={(event) => event.preventDefault()}
      >
        {!loaded && !failed && (
          <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              Loading protected image
            </span>
          </div>
        )}

        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <AlertTriangle size={22} className="mb-2 text-amber-600" />
            <p className="text-sm font-medium text-slate-800">This document could not be displayed.</p>
            <p className="mt-1 text-xs text-slate-500">Access may have ended, or the file may need DriveLink review.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : (
          // Protected identity images bypass Next's optimizer so the booking-scoped
          // request and no-store response remain end to end.
          // eslint-disable-next-line @next/next/no-img-element -- protected document requests must bypass the image optimizer.
          <img
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
            className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white/95 text-slate-800 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Enlarge ${alt}`}
            title="Enlarge image"
          >
            <Maximize2 size={17} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950" role="dialog" aria-modal="true" aria-label={alt}>
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-white/15 px-4 py-2 text-white">
            <p className="min-w-0 truncate text-sm font-medium">{alt}</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
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
      )}
    </>
  );
}
