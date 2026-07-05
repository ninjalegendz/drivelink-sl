"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient, realtimeReady } from "@/lib/supabase/client";

interface BookingRow {
  id: string;
}

interface Options<T extends BookingRow> {
  // Used to name the WS channel and avoid collisions between mounted lists.
  channelName: string;
  // postgres_changes filter, e.g. "agency_id=eq.UUID" or "renter_id=eq.UUID".
  // Omit for admin (all rows).
  filter?: string;
  // PostgREST select expression to hydrate joined columns on refetch.
  // Must produce rows of the same shape as the initial array.
  selectQuery: string;
  // Client-side predicate, used when the filter can't express the scope
  // (e.g. status filter on admin page that must apply to incoming rows).
  // Return true if the row belongs in this list.
  inScope?: (row: T) => boolean;
  // Comparator for ordering after inserts/updates. Default: newest first by created_at.
  compare?: (a: T, b: T) => number;
}

interface HasCreatedAt {
  created_at?: string;
}

function defaultCompare<T extends BookingRow & HasCreatedAt>(a: T, b: T): number {
  const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bT - aT;
}

/**
 * Live-bookings hook. Seeds local state from server-rendered initial rows,
 * then keeps that state in sync with postgres_changes on `public.bookings`.
 *
 * On INSERT/UPDATE we refetch the single affected row via PostgREST so that
 * joined columns (vehicles, profiles, agencies) come back populated, the
 * raw WAL payload only carries bookings columns.
 *
 * Channel registers with the user's JWT (setAuth before subscribe) so RLS
 * apply_rls evaluates as the logged-in role, not anon.
 */
export function useBookingsRealtime<T extends BookingRow & HasCreatedAt>(
  initial: T[],
  options: Options<T>,
): T[] {
  const [rows, setRows] = useState<T[]>(initial);
  const optsRef = useRef(options);
  optsRef.current = options;

  // Re-seed if the server hands us a fresh initial set (e.g. nav between filter tabs).
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refetchRow(id: string): Promise<T | null> {
      const { data, error } = await supabase
        .from("bookings")
        .select(optsRef.current.selectQuery)
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return data as unknown as T;
    }

    function applyUpsert(row: T) {
      const inScope = optsRef.current.inScope?.(row) ?? true;
      const cmp = optsRef.current.compare ?? defaultCompare;
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === row.id);
        if (!inScope) {
          // Out of scope now (e.g. status changed off the filter), drop it.
          return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
        }
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = row;
          next.sort(cmp);
          return next;
        }
        return [...prev, row].sort(cmp);
      });
    }

    function applyDelete(id: string) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }

    void realtimeReady().then(() => {
      if (cancelled) return;

      const insertFilter = optsRef.current.filter
        ? { event: "INSERT" as const, schema: "public", table: "bookings", filter: optsRef.current.filter }
        : { event: "INSERT" as const, schema: "public", table: "bookings" };
      const updateFilter = optsRef.current.filter
        ? { event: "UPDATE" as const, schema: "public", table: "bookings", filter: optsRef.current.filter }
        : { event: "UPDATE" as const, schema: "public", table: "bookings" };
      const deleteFilter = optsRef.current.filter
        ? { event: "DELETE" as const, schema: "public", table: "bookings", filter: optsRef.current.filter }
        : { event: "DELETE" as const, schema: "public", table: "bookings" };

      channel = supabase
        .channel(optsRef.current.channelName)
        .on("postgres_changes", insertFilter, async (payload: RealtimePostgresChangesPayload<BookingRow>) => {
          const id = (payload.new as BookingRow | undefined)?.id;
          if (!id) return;
          const full = await refetchRow(id);
          if (!cancelled && full) applyUpsert(full);
        })
        .on("postgres_changes", updateFilter, async (payload: RealtimePostgresChangesPayload<BookingRow>) => {
          const id = (payload.new as BookingRow | undefined)?.id;
          if (!id) return;
          const full = await refetchRow(id);
          if (!cancelled && full) applyUpsert(full);
        })
        .on("postgres_changes", deleteFilter, (payload: RealtimePostgresChangesPayload<BookingRow>) => {
          const id = (payload.old as BookingRow | undefined)?.id;
          if (id) applyDelete(id);
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // Re-subscribe when the channel name or filter changes (e.g. user switches tabs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.channelName, options.filter]);

  return rows;
}
