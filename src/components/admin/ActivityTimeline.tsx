import Link from "next/link";
import {
  Activity, CheckCircle2, XCircle, AlertCircle, Pencil, Trash2, Star,
  Receipt, FileCheck, FileX, Car, Calendar, ShieldCheck, MousePointerClick,
} from "lucide-react";

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
      return { Icon: Calendar, tone: "amber", title: "Booking awaiting agency confirmation" };
    case "booking.confirmed":
      return { Icon: CheckCircle2, tone: "emerald", title: "Agency confirmed the booking" };
    case "booking.declined":
      return {
        Icon: XCircle, tone: "red",
        title: "Agency declined the booking",
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
        title: "Admin edited the agency's details",
        detail: Array.isArray(m.fields) ? `Changed: ${(m.fields as string[]).join(", ")}` : undefined,
      };
    case "admin.agency_deleted":
      return { Icon: Trash2, tone: "red", title: "Admin soft-deleted this agency" };

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

const TONE_STYLES = {
  slate:   { icon: "text-slate-600",   bg: "bg-slate-100" },
  emerald: { icon: "text-emerald-700", bg: "bg-emerald-50" },
  amber:   { icon: "text-blue-600",   bg: "bg-blue-50" },
  red:     { icon: "text-rose-600",     bg: "bg-rose-50" },
  blue:    { icon: "text-blue-400",    bg: "bg-blue-50" },
} as const;

const ROLE_LABEL: Record<string, string> = {
  renter:       "Renter",
  agency_owner: "Agency",
  admin:        "Admin",
  system:       "System",
};

function BrowsingRow({ event }: { event: BrowsingEvent }) {
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
    <li className="flex gap-3">
      <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-slate-100">
        <MousePointerClick size={15} className="text-slate-500" />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 break-words text-sm text-slate-700">{label}</p>
          <p className="font-mono text-xs text-slate-400">
            {new Date(event.created_at).toLocaleString("en-LK", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        {event.path && <p className="mt-0.5 w-full truncate font-mono text-xs text-slate-500">{event.path}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>{origin}</span>
          {device && <span>{device}</span>}
          {event.country_code && <span>{event.country_code}</span>}
          {event.session_id && (
            <span className="font-mono text-slate-400">session {event.session_id.slice(0, 8)}</span>
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
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-500 text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {merged.map((item) => {
        if (item.kind === "browse") return <BrowsingRow key={item.browse!.id} event={item.browse!} />;
        const e = item.action!;
        const r = renderEvent(e);
        const tone = TONE_STYLES[r.tone];
        return (
          <li key={e.id} className="flex gap-3">
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${tone.bg}`}>
              <r.Icon size={16} className={tone.icon} />
            </div>
            <div className="min-w-0 flex-1 bg-white border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                <p className="min-w-0 break-words text-slate-900 text-sm font-medium">{r.title}</p>
                <p className="text-slate-400 text-xs font-mono">
                  {new Date(e.created_at).toLocaleString("en-LK", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              {r.detail && <p className="text-slate-600 text-xs mt-1">{r.detail}</p>}
              <div className="flex items-center gap-3 mt-1.5 text-xs">
                {e.actor_role && (
                  <span className="text-slate-500">By {ROLE_LABEL[e.actor_role] ?? e.actor_role}</span>
                )}
                {e.related_booking_id && (
                  <Link
                    href={`/admin/bookings`}
                    className="text-blue-600 hover:text-blue-500 font-mono"
                  >
                    {e.related_booking_id.slice(0, 8).toUpperCase()}
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
