import type { SupabaseClient } from "@supabase/supabase-js";
import { DEV_LOG_CATEGORIES, DEV_LOG_RANGES, DEV_LOG_ROLES } from "./labels";

// The admin Dev log feed: every activity_events row, newest first.
//
// Built to be read often without costing much:
//
//   - Keyset pagination on (created_at, id), never OFFSET. OFFSET makes the
//     database walk every skipped row on each page, and it shifts when new
//     rows arrive, which is how a paging log shows the same event twice or
//     skips one. A cursor of "older than this exact row" does neither.
//     Migration 131 adds the (created_at desc, id desc) index it walks.
//   - One query per page, limit + 1 rows so "is there more" needs no count.
//   - Names for the people, pages and listings a page mentions come from at
//     most three batched lookups, not one per row.
//   - Only the columns the screen renders. Admin data is never cached by a
//     CDN; the route that serves later pages sends `no-store`.
//
// Reads go through the caller's own session client, so row-level security
// (admins see all activity) stays the gatekeeper, not this code.

export const DEV_LOG_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DevLogFilters {
  category?: string;
  role?: string;
  actor?: string;
  entity?: string;
  range?: string;
}

export interface DevLogEntry {
  id: string;
  at: string;
  type: string;
  role: string | null;
  actorId: string | null;
  actorName: string | null;
  subjectKind: string;
  subjectId: string;
  renterId: string | null;
  agencyId: string | null;
  bookingId: string | null;
  meta: Record<string, unknown> | null;
}

export interface DevLogLabels {
  people: Record<string, string>;
  pages: Record<string, { name: string; slug: string | null }>;
  vehicles: Record<string, { name: string; slug: string | null }>;
}

export interface DevLogPage {
  entries: DevLogEntry[];
  labels: DevLogLabels;
  nextCursor: string | null;
}

/** Filters from untrusted query params, dropping anything not recognised.
 *  Ids must be real UUIDs: they are interpolated into a PostgREST `or`
 *  expression, so a free-form value could otherwise widen the filter. */
export function parseDevLogFilters(params: Record<string, string | undefined>): DevLogFilters {
  const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
    value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
  return {
    category: pick(params.category, DEV_LOG_CATEGORIES.map((c) => c.value)),
    role: pick(params.role, DEV_LOG_ROLES.map((r) => r.value)),
    actor: params.actor && UUID.test(params.actor) ? params.actor : undefined,
    entity: params.entity && UUID.test(params.entity) ? params.entity : undefined,
    range: pick(params.range, DEV_LOG_RANGES.map((r) => r.value)),
  };
}

/** "timestamp|id" of the last row shown. Plain text rather than base64:
 *  it travels in a query string (URLSearchParams encodes it), and Buffer is
 *  not guaranteed in every runtime this app deploys to. */
export function encodeCursor(at: string, id: string): string {
  return `${at}|${id}`;
}

export function decodeCursor(cursor: string | undefined | null): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id, extra] = cursor.split("|");
  if (extra !== undefined || !at || !id || !UUID.test(id) || Number.isNaN(Date.parse(at))) return null;
  // Only a strict ISO timestamp may reach the quoted filter below.
  if (!/^[0-9T:.+\- Z]+$/.test(at)) return null;
  return { at, id };
}

type Row = {
  id: string; created_at: string; event_type: string; actor_role: string | null; actor_id: string | null;
  subject_kind: string; subject_id: string; related_renter_id: string | null; related_agency_id: string | null;
  related_booking_id: string | null; metadata: Record<string, unknown> | null;
  actor: { full_name: string | null } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: DevLogFilters, now: number) {
  let q = query;
  if (filters.category) q = q.like("event_type", `${filters.category}.%`);
  if (filters.role) q = q.eq("actor_role", filters.role);
  if (filters.actor) q = q.eq("actor_id", filters.actor);
  if (filters.entity) {
    const e = filters.entity;
    q = q.or(`subject_id.eq.${e},related_renter_id.eq.${e},related_agency_id.eq.${e},related_booking_id.eq.${e}`);
  }
  if (filters.range) {
    const range = DEV_LOG_RANGES.find((r) => r.value === filters.range);
    if (range) q = q.gte("created_at", new Date(now - range.ms).toISOString());
  }
  return q;
}

export async function fetchDevLogPage(
  supabase: SupabaseClient,
  filters: DevLogFilters,
  cursor: string | null = null,
  limit = DEV_LOG_PAGE_SIZE,
): Promise<DevLogPage> {
  const size = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  let query = supabase
    .from("activity_events")
    .select(
      "id, created_at, event_type, actor_role, actor_id, subject_kind, subject_id, " +
      "related_renter_id, related_agency_id, related_booking_id, metadata, " +
      "actor:profiles!actor_id(full_name)",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);

  query = applyFilters(query, filters, Date.now());

  const after = decodeCursor(cursor);
  if (after) {
    // Strictly older than the last row shown, with the id breaking ties
    // between events written in the same instant (one transaction can write
    // several). Quoted because the timestamp carries ":" and "+".
    query = query.or(`created_at.lt."${after.at}",and(created_at.eq."${after.at}",id.lt.${after.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Dev log query failed.", { cause: error });

  const rows = (data ?? []) as unknown as Row[];
  const page = rows.slice(0, size);
  const entries: DevLogEntry[] = page.map((r) => ({
    id: r.id,
    at: r.created_at,
    type: r.event_type,
    role: r.actor_role,
    actorId: r.actor_id,
    actorName: r.actor?.full_name ?? null,
    subjectKind: r.subject_kind,
    subjectId: r.subject_id,
    renterId: r.related_renter_id,
    agencyId: r.related_agency_id,
    bookingId: r.related_booking_id,
    meta: r.metadata,
  }));

  const last = page[page.length - 1];
  return {
    entries,
    labels: await fetchLabels(supabase, entries),
    nextCursor: rows.length > size && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

/** How many events newer than `since` match the filters. Backs the "new
 *  events" notice, so it only counts (index range scan, no rows sent). */
export async function countDevLogSince(supabase: SupabaseClient, filters: DevLogFilters, since: string): Promise<number> {
  if (Number.isNaN(Date.parse(since))) return 0;
  let query = supabase.from("activity_events").select("id", { count: "exact", head: true }).gt("created_at", since);
  query = applyFilters(query, filters, Date.now());
  const { count, error } = await query;
  if (error) throw new Error("Dev log count failed.", { cause: error });
  return count ?? 0;
}

async function fetchLabels(supabase: SupabaseClient, entries: DevLogEntry[]): Promise<DevLogLabels> {
  const people = new Set<string>();
  const pages = new Set<string>();
  const vehicles = new Set<string>();
  for (const e of entries) {
    if (e.subjectKind === "renter") people.add(e.subjectId);
    if (e.subjectKind === "agency") pages.add(e.subjectId);
    if (e.subjectKind === "vehicle") vehicles.add(e.subjectId);
    if (e.renterId) people.add(e.renterId);
    if (e.agencyId) pages.add(e.agencyId);
  }

  const [p, a, v] = await Promise.all([
    people.size ? supabase.from("profiles").select("id, full_name").in("id", [...people]) : Promise.resolve({ data: [] }),
    pages.size ? supabase.from("agencies").select("id, name, slug").in("id", [...pages]) : Promise.resolve({ data: [] }),
    vehicles.size ? supabase.from("vehicles").select("id, year, make, model, slug").in("id", [...vehicles]) : Promise.resolve({ data: [] }),
  ]);

  const labels: DevLogLabels = { people: {}, pages: {}, vehicles: {} };
  for (const row of (p.data ?? []) as { id: string; full_name: string | null }[]) {
    if (row.full_name) labels.people[row.id] = row.full_name;
  }
  for (const row of (a.data ?? []) as { id: string; name: string; slug: string | null }[]) {
    labels.pages[row.id] = { name: row.name, slug: row.slug };
  }
  for (const row of (v.data ?? []) as { id: string; year: number; make: string; model: string; slug: string | null }[]) {
    labels.vehicles[row.id] = { name: `${row.year} ${row.make} ${row.model}`, slug: row.slug };
  }
  return labels;
}
