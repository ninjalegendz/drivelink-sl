import type { SupabaseClient } from "@supabase/supabase-js";

export interface Range {
  startIso: string;
  endIso:   string;
}

/** Returns counts of bookings created within the range, grouped by status. */
export async function bookingCountsByStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string,
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
  agencyId?: string,
): Promise<Array<{ date: string; count: number }>> {
  let q = service.from("bookings").select("created_at").gte("created_at", range.startIso).lt("created_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;

  const byDate = new Map<string, number>();
  for (const row of (data ?? []) as { created_at: string }[]) {
    const date = row.created_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }

  const out: Array<{ date: string; count: number }> = [];
  const startMs = new Date(range.startIso).getTime();
  const endMs = new Date(range.endIso).getTime();
  for (let ms = startMs; ms < endMs; ms += 86_400_000) {
    const date = new Date(ms).toISOString().slice(0, 10);
    out.push({ date, count: byDate.get(date) ?? 0 });
  }
  return out;
}

/** Rental value and DriveLink confirmation-fee snapshots on completed bookings. */
export async function revenueTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string,
): Promise<{
  completed:         number;
  rental_revenue:    number;
  confirmation_fees: number;
}> {
  let q = service
    .from("bookings")
    .select("subtotal_lkr, booking_fee_lkr")
    .eq("status", "completed")
    .gte("completed_at", range.startIso)
    .lt("completed_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;

  const rows = (data ?? []) as Array<{ subtotal_lkr: number; booking_fee_lkr: number }>;
  return {
    completed:         rows.length,
    rental_revenue:    rows.reduce((sum, row) => sum + row.subtotal_lkr, 0),
    confirmation_fees: rows.reduce((sum, row) => sum + row.booking_fee_lkr, 0),
  };
}

/** Conversion funnel: requests -> reserved -> started -> completed. */
export async function conversionFunnel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  range: Range,
  agencyId?: string,
): Promise<{ requested: number; reserved: number; started: number; completed: number }> {
  let q = service
    .from("bookings")
    .select("status, confirmed_at, activated_at, completed_at")
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso);
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  const rows = (data ?? []) as Array<{
    status: string;
    confirmed_at: string | null;
    activated_at: string | null;
    completed_at: string | null;
  }>;
  return {
    requested: rows.length,
    reserved:  rows.filter((row) => row.confirmed_at).length,
    started:   rows.filter((row) => row.activated_at).length,
    completed: rows.filter((row) => row.status === "completed").length,
  };
}

export function rangeForKey(key: "7d" | "30d" | "90d" | "ytd"): Range {
  const now = new Date();
  const endIso = now.toISOString();
  if (key === "ytd") {
    return { startIso: new Date(now.getFullYear(), 0, 1).toISOString(), endIso };
  }
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  return { startIso: new Date(Date.now() - days * 86_400_000).toISOString(), endIso };
}
