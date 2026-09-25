import Link from "next/link";
import {
  Activity, CheckCircle2, XCircle, AlertCircle, Pencil, Trash2, Star,
  Receipt, FileCheck, FileX, Car, Calendar, ShieldCheck, MousePointerClick,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDay, sriLankaDayKey, formatInstantClock } from "@/lib/dates/display";

export interface ActivityEvent {
  id:                  string;
  actor_id:            string | null;
  actor_role:          "renter" | "agency_owner" | "admin" | "system" | null;
  event_type:          string;
  subject_kind:        string;
  subject_id:          string;
  related_booking_id:  string | null;
  metadata:            Record<string, unknown> | null;
  created_at:          string;
}

/**
 * A page view or journey step from traffic analytics. Platform actions alone
 * ("booking confirmed") say what someone did but not how they got there;
 * merging these in shows the visit that led to it, and where it came from.
 */
export interface BrowsingEvent {
  id:             string;
  event_name:     string;
  path:           string | null;
  entity_type:    string | null;
  entity_id:      string | null;
  created_at:     string;
  session_id:     string | null;
  source_category: string | null;
  source_host:    string | null;
  campaign_source: string | null;
  device_type:    string | null;
  browser_family: string | null;
  country_code:   string | null;
  landing_path:   string | null;
}

const BROWSING_LABEL: Record<string, string> = {
  page_view: "Viewed a page",
  vehicle_view: "Opened a vehicle listing",
  booking_form_view: "Opened the booking form",
  booking_request_started: "Started a booking request",
  booking_request_submitted: "Submitted a booking request",
  guide_opened: "Opened a guide",
  search_submitted: "Searched",
};

interface EventRender {
  Icon:     React.ComponentType<{ size?: number; className?: string }>;
  tone:     "slate" | "emerald" | "amber" | "red" | "blue";
  title:    string;
  detail?:  string;
}

function renderEvent(e: ActivityEvent): EventRender {
  const m = e.metadata ?? {};

  switch (e.event_type) {
    // ─── Booking lifecycle ────────────────────────────────────
    case "booking.created":
      return {
        Icon: Calendar, tone: "slate",
        title: "Booking request created",
        detail: typeof m.start_date === "string" ? `${m.start_date} → ${m.end_date} (${m.days} days)` : undefined,
      };
    case "booking.pending_confirmation":
      return { Icon: Calendar, tone: "amber", title: "Booking awaiting Rental Page confirmation" };
    case "booking.confirmed":
      return { Icon: CheckCircle2, tone: "emerald", title: "Rental Page confirmed the booking" };
    case "booking.declined":
      return {
        Icon: XCircle, tone: "red",
        title: "Rental Page declined the booking",
        detail: typeof m.reason === "string" ? m.reason : undefined,
      };
    case "booking.cancelled":
      return {
        Icon: XCircle, tone: "red",
        title: "Booking cancelled",
        detail: typeof m.reason === "string" ? m.reason : undefined,
      };
    case "booking.payment_pending":
      return { Icon: Receipt, tone: "blue", title: "Legacy payment proof uploaded" };
    case "booking.active":
      return { Icon: CheckCircle2, tone: "emerald", title: "Booking activated" };
    case "booking.completed":
      return { Icon: CheckCircle2, tone: "emerald", title: "Booking completed" };
    case "booking.disputed":
      return { Icon: AlertCircle, tone: "red", title: "Booking entered dispute" };

    // ─── Admin actions ────────────────────────────────────────
    case "admin.rating_adjusted":
      return {
        Icon: Star, tone: "amber",
        title: `Admin adjusted ${m.field === "rating_avg" ? "rating" : "reliability"} by ${(m.delta as number) >= 0 ? "+" : ""}${m.delta}`,
        detail: typeof m.reason === "string" ? `Reason: ${m.reason}` : undefined,
      };
    case "admin.user_edited":
      return {
        Icon: Pencil, tone: "slate",
        title: "Admin edited the user's profile",
        detail: Array.isArray(m.fields) ? `Changed: ${(m.fields as string[]).join(", ")}` : undefined,
      };
    case "admin.user_deleted":
      return { Icon: Trash2, tone: "red", title: "Admin soft-deleted this account" };
    case "admin.agency_edited":
      return {
        Icon: Pencil, tone: "slate",
        title: "Admin edited the Rental Page's details",
        detail: Array.isArray(m.fields) ? `Changed: ${(m.fields as string[]).join(", ")}` : undefined,
      };
    case "admin.agency_deleted":
      return { Icon: Trash2, tone: "red", title: "Admin soft-deleted this Rental Page" };

    // ─── KYC events ───────────────────────────────────────────
    case "kyc.verified":
      return { Icon: ShieldCheck, tone: "emerald", title: "Identity verification approved" };
    case "kyc.rejected":
      return { Icon: FileX, tone: "red", title: "Identity verification rejected" };
    case "kyc.pending":
      return { Icon: FileCheck, tone: "amber", title: "Identity verification submitted" };

    // ─── Vehicle events ──────────────────────────────────────
    case "vehicle.created":
      return { Icon: Car, tone: "slate", title: "Vehicle listed" };
    case "vehicle.approved":
      return { Icon: CheckCircle2, tone: "emerald", title: "Vehicle approved by admin" };
    case "vehicle.unlisted":
      return { Icon: XCircle, tone: "amber", title: "Vehicle unlisted" };

    default:
      return { Icon: Activity, tone: "slate", title: e.event_type };
  }
}

// One meaning per colour, matching the rest of the product: emerald done,
// amber needs attention, rose a real risk, blue a plain action, slate neutral.
const TONE_STYLES = {
  slate:   { icon: "text-slate-600",   bg: "bg-slate-100",  ring: "ring-slate-200" },
  emerald: { icon: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-100" },
  amber:   { icon: "text-amber-700",   bg: "bg-amber-50",   ring: "ring-amber-100" },
  red:     { icon: "text-rose-700",    bg: "bg-rose-50",    ring: "ring-rose-100" },
  blue:    { icon: "text-blue-700",    bg: "bg-blue-50",    ring: "ring-blue-100" },
} as const;

const ROLE_LABEL: Record<string, string> = {
  renter:       "Renter",
  agency_owner: "Rental Page",
  admin:        "Admin",
  system:       "System",
};

/** "2026-09-20T10:00:00.000Z" -> "2026-09-20", the grouping key for a day heading. */
function dayKeyOf(iso: string): string {
  return sriLankaDayKey(iso);
}

/** "2026-09-20T10:00:00.000Z" -> "10:00:00", fed to formatClock. */
function clockOf(iso: string): string {
  return formatInstantClock(iso);
}

function BrowsingRow({ event, last }: { event: BrowsingEvent; last?: boolean }) {
  const label = BROWSING_LABEL[event.event_name] ?? event.event_name;
  // Where the visit came from: a campaign beats a referrer, a referrer beats
  // the coarse category, and "direct" is what is left.
  const origin = event.campaign_source
    ? `campaign ${event.campaign_source}`
    : event.source_host
      ? `via ${event.source_host}`
      : event.source_category && event.source_category !== "direct"
        ? `via ${event.source_category}`
        : "direct";

  const device = [event.device_type, event.browser_family].filter(Boolean).join(" · ");

  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />}
      <span className="relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 ring-4 ring-white">
        <MousePointerClick size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 break-words text-sm text-slate-700">{label}</p>
          <p className="tabular shrink-0 text-xs text-slate-400">{clockOf(event.created_at)}</p>
        </div>
        {event.path && <p className="mt-0.5 w-full truncate font-mono text-xs text-slate-500">{event.path}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>{origin}</span>
          {device && <span>{device}</span>}
          {event.country_code && <span>{event.country_code}</span>}
          {event.session_id && <span className="font-mono text-slate-400">session {event.session_id.slice(0, 8)}</span>}
        </div>
      </div>
    </li>
  );
}

function ActionRow({ event, last }: { event: ActivityEvent; last?: boolean }) {
  const r = renderEvent(event);
  const tone = TONE_STYLES[r.tone];
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />}
      <span className={`relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${tone.bg}`}>
        <r.Icon size={15} className={tone.icon} />
      </span>
      <div className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-900/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 break-words text-sm font-medium text-slate-900">{r.title}</p>
          <p className="tabular shrink-0 text-xs text-slate-400">{clockOf(event.created_at)}</p>
        </div>
        {r.detail && <p className="mt-1 text-xs leading-5 text-slate-600">{r.detail}</p>}
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          {event.actor_role && <span className="text-slate-500">By {ROLE_LABEL[event.actor_role] ?? event.actor_role}</span>}
          {event.related_booking_id && (
            <Link href="/admin/bookings" className="font-mono text-blue-700 hover:text-blue-800">
              {event.related_booking_id.slice(0, 8).toUpperCase()}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export function ActivityTimeline({
  events,
  browsing = [],
}: {
  events: ActivityEvent[];
  browsing?: BrowsingEvent[];
}) {
  // One chronological stream, newest first, so a platform action sits directly
  // after the browsing that produced it.
  const merged = [
    ...events.map((e) => ({ at: e.created_at, kind: "action" as const, action: e, browse: null })),
    ...browsing.map((b) => ({ at: b.created_at, kind: "browse" as const, action: null, browse: b })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  if (merged.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState bare icon={<Activity size={22} className="text-slate-400" strokeWidth={1.5} />} title="No activity recorded yet" />
      </Card>
    );
  }

  // Grouped by calendar day, newest day first, so a reviewer can scan "what
  // happened on this day" instead of assembling a flat list themselves.
  const days: { key: string; items: typeof merged }[] = [];
  for (const item of merged) {
    const key = dayKeyOf(item.at);
    const group = days[days.length - 1]?.key === key ? days[days.length - 1] : undefined;
    if (group) group.items.push(item);
    else days.push({ key, items: [item] });
  }

  return (
    <div className="space-y-7">
      {days.map((day) => (
        <div key={day.key}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{formatDay(day.key)}</p>
          <ol className="relative">
            {day.items.map((item, i) => {
              const last = i === day.items.length - 1;
              return item.kind === "browse"
                ? <BrowsingRow key={item.browse!.id} event={item.browse!} last={last} />
                : <ActionRow key={item.action!.id} event={item.action!} last={last} />;
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
