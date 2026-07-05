import Link from "next/link";
import {
  Activity, CheckCircle2, XCircle, AlertCircle, Pencil, Trash2, Star,
  Receipt, FileCheck, FileX, Car, Calendar, ShieldCheck,
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
      return { Icon: Receipt, tone: "blue", title: "Renter uploaded payment slip" };
    case "booking.active":
      return { Icon: CheckCircle2, tone: "emerald", title: "Booking activated (payment verified)" };
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
  emerald: { icon: "text-emerald-400", bg: "bg-emerald-500/10" },
  amber:   { icon: "text-blue-600",   bg: "bg-blue-500/10" },
  red:     { icon: "text-red-400",     bg: "bg-red-500/10" },
  blue:    { icon: "text-blue-400",    bg: "bg-blue-500/10" },
} as const;

const ROLE_LABEL: Record<string, string> = {
  renter:       "Renter",
  agency_owner: "Agency",
  admin:        "Admin",
  system:       "System",
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-500 text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const r = renderEvent(e);
        const tone = TONE_STYLES[r.tone];
        return (
          <li key={e.id} className="flex gap-3">
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${tone.bg}`}>
              <r.Icon size={16} className={tone.icon} />
            </div>
            <div className="flex-1 bg-white border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-slate-900 text-sm font-medium">{r.title}</p>
                <p className="text-slate-400 text-xs font-mono shrink-0">
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
