"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps a server-seeded list in sync by re-running a caller-supplied query on an
 * interval, instead of holding an open realtime channel + refetching a full
 * joined row on every WAL event per subscriber. At scale that fan-out is the
 * priciest realtime path; polling a bounded list every ~20s is predictable and
 * cheap, and pauses while the tab is hidden.
 *
 * Lightweight single-row subscriptions (the renter's booking-status screen, the
 * agency new-booking toast) stay on realtime, this is only for the big lists.
 */
export function usePolledRows<T>(
  initial: T[],
  poll: () => Promise<T[] | null>,
  { intervalMs = 20_000 }: { intervalMs?: number } = {},
): T[] {
  const [rows, setRows] = useState<T[]>(initial);
  const pollRef = useRef(poll);
  pollRef.current = poll;

  // Re-seed when the server hands a fresh set (e.g. nav between filter tabs).
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        const next = await pollRef.current();
        if (!cancelled && next) setRows(next);
      } catch {
        /* transient network error, keep the last good rows, try again next tick */
      }
    }

    function schedule() {
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await refresh();
        if (!cancelled) schedule();
      }, intervalMs);
    }
    schedule();

    // Refresh immediately when the user returns to the tab.
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return rows;
}
