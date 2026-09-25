import type { DevLogEntry, DevLogFilters, DevLogLabels, DevLogPage } from "@/lib/activity/feed";
import { DEV_LOG_RANGES } from "@/lib/activity/labels";

// Sample Dev log for /design/admin/activity. Times are generated relative to
// now so "Today" and "Yesterday" always have something in them.

const PEOPLE: Record<string, string> = {
  "10000000-0000-4000-8000-000000000001": "Umar Hassan",
  "10000000-0000-4000-8000-000000000002": "Nimal Perera",
  "10000000-0000-4000-8000-000000000003": "Ayesha Fernando",
  "10000000-0000-4000-8000-000000000004": "Kasun Bandara",
  "10000000-0000-4000-8000-000000000005": "Dilani Silva",
};
const [ADMIN, NIMAL, AYESHA, KASUN, DILANI] = Object.keys(PEOPLE);
const SERENDIB = "00000000-0000-4000-8000-00000000a001";
const NIMALS = "00000000-0000-4000-8000-00000000a003";
const COROLLA = "00000000-0000-4000-8000-000000000001";
const KOMBI = "00000000-0000-4000-8000-000000000007";
const BOOKING_A = "a1b2c3d4-0000-4000-9000-000000000001";
const BOOKING_B = "7f3e9b21-0000-4000-9000-000000000002";

type Seed = Omit<DevLogEntry, "id" | "at" | "actorName" | "renterId" | "agencyId" | "bookingId" | "meta"> &
  Partial<Pick<DevLogEntry, "renterId" | "agencyId" | "bookingId" | "meta">> & { minutesAgo: number };

const SEEDS: Seed[] = [
  { minutesAgo: 4,    type: "booking.confirmed", role: "agency_owner", actorId: NIMAL, subjectKind: "booking", subjectId: BOOKING_A, renterId: AYESHA, agencyId: NIMALS, bookingId: BOOKING_A, meta: { from_status: "pending_confirmation", to_status: "confirmed" } },
  { minutesAgo: 11,   type: "vehicle.price_changed", role: "agency_owner", actorId: NIMAL, subjectKind: "vehicle", subjectId: KOMBI, agencyId: NIMALS, meta: { name: "1979 Volkswagen Kombi", daily_from: 20000, daily_to: 22000, deposit_from: 0, deposit_to: 0 } },
  { minutesAgo: 26,   type: "booking.created", role: "renter", actorId: AYESHA, subjectKind: "booking", subjectId: BOOKING_A, renterId: AYESHA, agencyId: NIMALS, bookingId: BOOKING_A, meta: { start_date: "2026-10-02", end_date: "2026-10-05", days: 3 } },
  { minutesAgo: 48,   type: "identity.verified", role: "system", actorId: null, subjectKind: "renter", subjectId: AYESHA, renterId: AYESHA, meta: { from: "pending", to: "verified" } },
  { minutesAgo: 55,   type: "identity.pending", role: "renter", actorId: AYESHA, subjectKind: "renter", subjectId: AYESHA, renterId: AYESHA, meta: { from: "unverified", to: "pending" } },
  { minutesAgo: 63,   type: "account.phone_verified", role: "renter", actorId: AYESHA, subjectKind: "renter", subjectId: AYESHA, renterId: AYESHA },
  { minutesAgo: 70,   type: "account.created", role: "renter", actorId: AYESHA, subjectKind: "renter", subjectId: AYESHA, renterId: AYESHA, meta: { name: "Ayesha Fernando" } },
  { minutesAgo: 95,   type: "admin.vehicle_moderated", role: "admin", actorId: ADMIN, subjectKind: "vehicle", subjectId: COROLLA, agencyId: SERENDIB, meta: { action: "approve" } },
  { minutesAgo: 96,   type: "vehicle.available", role: "admin", actorId: ADMIN, subjectKind: "vehicle", subjectId: COROLLA, agencyId: SERENDIB, meta: { name: "2019 Toyota Corolla Hybrid", from: "pending_review", to: "available" } },
  { minutesAgo: 140,  type: "team.member_added", role: "agency_owner", actorId: KASUN, subjectKind: "agency", subjectId: SERENDIB, renterId: DILANI, agencyId: SERENDIB, meta: { role: "booking_agent" } },
  { minutesAgo: 210,  type: "vehicle.pending_review", role: "agency_owner", actorId: KASUN, subjectKind: "vehicle", subjectId: COROLLA, agencyId: SERENDIB, meta: { name: "2019 Toyota Corolla Hybrid", from: "unlisted", to: "pending_review" } },
  { minutesAgo: 60 * 20,  type: "booking.completed", role: "system", actorId: null, subjectKind: "booking", subjectId: BOOKING_B, renterId: DILANI, agencyId: SERENDIB, bookingId: BOOKING_B, meta: { from_status: "active", to_status: "completed" } },
  { minutesAgo: 60 * 21,  type: "review.posted", role: "renter", actorId: DILANI, subjectKind: "agency", subjectId: SERENDIB, renterId: DILANI, agencyId: SERENDIB, bookingId: BOOKING_B, meta: { rating: 5 } },
  { minutesAgo: 60 * 26,  type: "page.whatsapp_verified", role: "agency_owner", actorId: KASUN, subjectKind: "agency", subjectId: SERENDIB, agencyId: SERENDIB },
  { minutesAgo: 60 * 27,  type: "admin.rating_adjusted", role: "admin", actorId: ADMIN, subjectKind: "renter", subjectId: KASUN, renterId: KASUN, meta: { reason: "Late cancellation was caused by a flood closure", delta: 5 } },
  { minutesAgo: 60 * 30,  type: "booking.disputed", role: "agency_owner", actorId: KASUN, subjectKind: "booking", subjectId: BOOKING_B, renterId: DILANI, agencyId: SERENDIB, bookingId: BOOKING_B, meta: { from_status: "active", to_status: "disputed" } },
  { minutesAgo: 60 * 50,  type: "page.created", role: "agency_owner", actorId: NIMAL, subjectKind: "agency", subjectId: NIMALS, agencyId: NIMALS, meta: { name: "Nimal's Car Hire", page_type: "personal", city: "Galle" } },
  { minutesAgo: 60 * 52,  type: "account.created", role: "agency_owner", actorId: NIMAL, subjectKind: "renter", subjectId: NIMAL, renterId: NIMAL, meta: { name: "Nimal Perera" } },
  { minutesAgo: 60 * 70,  type: "vehicle.photos_changed", role: "agency_owner", actorId: KASUN, subjectKind: "vehicle", subjectId: COROLLA, agencyId: SERENDIB, meta: { name: "2019 Toyota Corolla Hybrid", from_count: 3, to_count: 5 } },
  { minutesAgo: 60 * 75,  type: "blacklist.report_filed", role: "agency_owner", actorId: KASUN, subjectKind: "renter", subjectId: DILANI, renterId: DILANI, agencyId: SERENDIB, meta: { reason: "Returned the vehicle 6 hours late without contact" } },
];

const LABELS: DevLogLabels = {
  people: PEOPLE,
  pages: {
    [SERENDIB]: { name: "Serendib Drive", slug: "serendib-drive" },
    [NIMALS]: { name: "Nimal's Car Hire", slug: "nimals-car-hire" },
  },
  vehicles: {
    [COROLLA]: { name: "2019 Toyota Corolla Hybrid", slug: "demo-toyota-corolla-2019-colombo" },
    [KOMBI]: { name: "1979 Volkswagen Kombi", slug: "demo-volkswagen-kombi-1979-galle" },
  },
};

export function demoDevLog(filters: DevLogFilters): DevLogPage {
  const now = Date.now();
  const range = DEV_LOG_RANGES.find((r) => r.value === filters.range);
  const entries: DevLogEntry[] = SEEDS.map((s, i) => {
    const { minutesAgo, ...rest } = s;
    return {
      id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      at: new Date(now - minutesAgo * 60_000).toISOString(),
      actorName: s.actorId ? PEOPLE[s.actorId] ?? null : null,
      renterId: rest.renterId ?? null,
      agencyId: rest.agencyId ?? null,
      bookingId: rest.bookingId ?? null,
      meta: rest.meta ?? null,
      type: rest.type,
      role: rest.role,
      actorId: rest.actorId,
      subjectKind: rest.subjectKind,
      subjectId: rest.subjectId,
    };
  }).filter((e) =>
    (!filters.category || e.type.startsWith(`${filters.category}.`))
    && (!filters.role || e.role === filters.role)
    && (!filters.actor || e.actorId === filters.actor)
    && (!filters.entity || [e.subjectId, e.renterId, e.agencyId, e.bookingId].includes(filters.entity))
    && (!range || now - Date.parse(e.at) <= range.ms),
  );
  return { entries, labels: LABELS, nextCursor: null };
}
