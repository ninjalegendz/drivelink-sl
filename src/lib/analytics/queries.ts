// Shared analytics queries, return shapes for the admin + agency
// dashboards. All queries use the supplied supabase client so the
// caller controls the auth context (admin → all, agency → own).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Range {
  startIso: string; // inclusive
  endIso:   string; // exclusive
}

/** Returns counts of bookings by status within the range. */
export async function bookingCountsByStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string
): Promise<Record<string, number>> {
  let q = service.from("bookings").select("status").gte("created_at", range.startIso).lt("created_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

/** Daily booking creation count for a sparkline. */
export async function dailyBookingTrend(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string
): Promise<Array<{ date: string; count: number }>> {
  let q = service.from("bookings").select("created_at").gte("created_at", range.startIso).lt("created_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;

  const byDate = new Map<string, number>();
  for (const r of (data ?? []) as { created_at: string }[]) {
    const d = r.created_at.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  // Fill missing days with zero
  const out: Array<{ date: string; count: number }> = [];
  const startMs = new Date(range.startIso).getTime();
  const endMs   = new Date(range.endIso).getTime();
  for (let ms = startMs; ms < endMs; ms += 86400_000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    out.push({ date: d, count: byDate.get(d) ?? 0 });
  }
  return out;
}

/** Revenue + fee totals from completed bookings in the range. */
export async function revenueTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string
): Promise<{
  completed:         number;
  rental_revenue:    number; // sum of subtotal_lkr, what the agency earned through us
  platform_fees:     number; // sum of agency_fee_lkr, what we earned
  collected_fees:    number; // agency_fee_lkr where agency_fee_collected_at IS NOT NULL
  outstanding_fees:  number; // total - collected
  lock_in_fees:      number; // sum of booking_fee_lkr we received
}> {
  let q = service
    .from("bookings")
    .select("subtotal_lkr, agency_fee_lkr, booking_fee_lkr, agency_fee_collected_at")
    .eq("status", "completed")
    .gte("completed_at", range.startIso)
    .lt("completed_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;

  const rows = (data ?? []) as Array<{
    subtotal_lkr: number;
    agency_fee_lkr: number;
    booking_fee_lkr: number;
    agency_fee_collected_at: string | null;
  }>;

  return {
    completed:        rows.length,
    rental_revenue:   rows.reduce((s, r) => s + r.subtotal_lkr,    0),
    platform_fees:    rows.reduce((s, r) => s + r.agency_fee_lkr,  0),
    collected_fees:   rows.filter((r) => r.agency_fee_collected_at).reduce((s, r) => s + r.agency_fee_lkr, 0),
    outstanding_fees: rows.filter((r) => !r.agency_fee_collected_at).reduce((s, r) => s + r.agency_fee_lkr, 0),
    lock_in_fees:     rows.reduce((s, r) => s + r.booking_fee_lkr, 0),
  };
}

/** Conversion funnel: requests → confirmed → paid → completed. */
export async function conversionFunnel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string
): Promise<{ requested: number; confirmed: number; paid: number; completed: number }> {
  let q = service
    .from("bookings")
    .select("status, confirmed_at, slip_url, completed_at")
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  const rows = (data ?? []) as Array<{
    status: string;
    confirmed_at: string | null;
    slip_url: string | null;
    completed_at: string | null;
  }>;
  return {
    requested: rows.length,
    confirmed: rows.filter((r) => r.confirmed_at).length,
    paid:      rows.filter((r) => r.slip_url).length,
    completed: rows.filter((r) => r.status === "completed").length,
  };
}

/** Pre-computed date ranges helper. */
export function rangeForKey(key: "7d" | "30d" | "90d" | "ytd"): Range {
  const now = new Date();
  const endIso = now.toISOString();
  if (key === "ytd") {
    return { startIso: new Date(now.getFullYear(), 0, 1).toISOString(), endIso };
  }
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  return { startIso: new Date(Date.now() - days * 86400_000).toISOString(), endIso };
}
