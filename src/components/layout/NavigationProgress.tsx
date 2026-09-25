"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Navigation progress indicator.
 *
 * Why this exists: `loading.tsx` does not cover the part of a navigation that
 * people actually notice. When a link to a dynamic route is tapped, Next first
 * fetches that route's payload and only swaps in the loading boundary once it
 * arrives. Until then the previous page stays fully on screen and the URL does
 * not even change.
 *
 * Measured on production as a signed-in owner (300ms latency, 700kbps, 4x CPU),
 * time from tap to the first pixel changing anywhere on the page:
 *
 *   /dashboard      -> /dashboard/vehicles       2403ms
 *   /dashboard/..   -> /dashboard/vehicles/new   2476ms
 *   /dashboard      -> /dashboard/bookings       3475ms
 *   /account        -> /account/documents         106ms
 *
 * Signed-in routes are the bad case: they are auth-gated so Next never
 * prefetches them, and each does several database round trips. Public
 * marketplace pages were already 100-500ms. /account/documents is the tell -
 * it is the one route with its own segment-level loading.tsx.
 *
 * Two-plus seconds of an unchanged screen reads as a dead button, so people
 * tap again, which starts the whole thing over. See
 * scripts/measure-nav-feedback.mjs to re-measure.
 *
 * Feedback escalates rather than arriving all at once:
 *   under 120ms  nothing, so a fast navigation does not flash
 *   120ms        a progress bar across the top
 *   700ms        a labelled "Loading" pill as well, which is hard to miss on a
 *                phone in daylight, where a 4px bar is not
 */

/** Programmatic navigations (a router.push in a handler) announce themselves here. */
const START_EVENT = "drivelink:navigation-start";

/** Call immediately before a router.push that leaves the current page. */
export function startNavigationProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

const SHOW_BAR_MS = 120;
const SHOW_PILL_MS = 700;
/** Longest we will ever show it. A stuck bar is worse than no bar. */
const MAX_VISIBLE_MS = 30_000;

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Whether clicking this anchor is a same-tab, in-app route change. */
function navigatesInApp(anchor: HTMLAnchorElement, current: string): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  // mailto:, tel:, blob: and friends never reach the router.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  // Same page, hash only: that scrolls, it does not load.
  if (url.pathname + url.search === current) return false;
  return true;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<"idle" | "bar" | "pill">("idle");
  const [progress, setProgress] = useState(0);

  // Timers live in a ref so starting/stopping never re-subscribes the listeners.
  const timers = useRef<number[]>([]);
  const active = useRef(false);
  // The route currently on screen, used to tell a real history navigation from
  // a fragment jump that leaves the page exactly where it is.
  const currentRoute = useRef("");

  const stop = useCallback(() => {
    for (const id of timers.current) { window.clearTimeout(id); window.clearInterval(id); }
    timers.current = [];
    active.current = false;
    setPhase("idle");
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;

    timers.current.push(window.setTimeout(() => {
      setPhase("bar");
      setProgress(8);
      // Creep towards 90 and wait there. The bar must never claim to be
      // finished while the page is still coming.
      timers.current.push(window.setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(0.6, (90 - p) / 12)));
      }, 200));
    }, SHOW_BAR_MS));

    timers.current.push(window.setTimeout(() => setPhase("pill"), SHOW_PILL_MS));
    timers.current.push(window.setTimeout(stop, MAX_VISIBLE_MS));
  }, [stop]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event) || event.defaultPrevented) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      // An anchor that opens something in place (the vehicle quick view) keeps
      // a real href for new tabs and search engines but never navigates on a
      // plain click. This listener runs before that click handler can cancel
      // the navigation, so without the opt-out the bar and its "Loading" pill
      // hung on screen until their own timeout over an open dialog.
      if (anchor.hasAttribute("data-no-progress")) return;
      if (!navigatesInApp(anchor as HTMLAnchorElement, window.location.pathname + window.location.search)) return;
      start();
    }

    // Capture phase, so this runs before the router handles the click.
    document.addEventListener("click", onClick, { capture: true });
    // A back/forward gesture is a wait worth showing, but only when it really
    // changes route. Clicking a fragment link can also raise popstate, and that
    // never commits a new route, so the bar would hang until its own timeout.
    function onPopState() {
      if (window.location.pathname + window.location.search === currentRoute.current) return;
      start();
    }

    window.addEventListener(START_EVENT, start);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener(START_EVENT, start);
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  // The route committed, so whatever we were waiting for has arrived.
  useEffect(() => {
    const query = searchParams?.toString();
    currentRoute.current = query ? `${pathname}?${query}` : pathname;
    stop();
  }, [pathname, searchParams, stop]);
  useEffect(() => stop, [stop]);

  if (phase === "idle") return null;

  return (
    <>
      <div
        data-navigation-progress=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-blue-100"
        style={{ marginTop: "env(safe-area-inset-top)" }}
      >
        <div
          className="h-full bg-blue-600 transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {phase === "pill" && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center"
          style={{ marginTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-lg backdrop-blur">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            Loading
          </span>
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">Loading page</span>
    </>
  );
}
