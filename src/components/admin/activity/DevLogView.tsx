"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Building2, CalendarCheck, Car, ChevronDown, Download, Flag, RefreshCw, ScrollText,
  ShieldCheck, Star, UserRound, Users, Wrench, X, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { chipClasses } from "@/components/ui/Chip";
import {
  DEV_LOG_CATEGORIES, DEV_LOG_RANGES, DEV_LOG_ROLES, META_LABELS,
  actorRoleLabel, eventCategory, eventPhrase, type Tone,
} from "@/lib/activity/labels";
import type { DevLogEntry, DevLogFilters, DevLogLabels, DevLogPage } from "@/lib/activity/feed";

// The admin Dev log: every recorded action, newest first, grouped by day in
// Sri Lanka time. Filters live in the URL (so a filtered view can be shared
// and the server renders it), later pages load on demand, and new events are
// announced rather than pushed into the list, so the row someone is reading
// never jumps.
//
// Cost when left open all day: one small count request a minute, and only
// while the tab is actually visible. No realtime subscription, no rows until
// someone asks for them.

const BASE = "/admin/activity";
const POLL_MS = 60_000;
const TIME_ZONE = "Asia/Colombo";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  booking: CalendarCheck,
  vehicle: Car,
  page: Building2,
  team: Users,
  account: UserRound,
  identity: ShieldCheck,
  review: Star,
  admin: Wrench,
  blacklist: Flag,
};

const TONE: Record<Tone, string> = {
  neutral:   "bg-slate-100 text-slate-600",
  positive:  "bg-emerald-50 text-emerald-700",
  attention: "bg-amber-50 text-amber-700",
  risk:      "bg-rose-50 text-rose-700",
};

const ROLE_BADGE: Record<string, string> = {
  admin:        "bg-rose-50 text-rose-700 ring-rose-600/15",
  agency_owner: "bg-blue-50 text-blue-800 ring-blue-600/15",
  renter:       "bg-slate-100 text-slate-700 ring-slate-500/15",
  system:       "bg-slate-50 text-slate-500 ring-slate-400/15",
};

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function hrefWith(filters: DevLogFilters, overrides: Partial<Record<keyof DevLogFilters, string | undefined>>): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["category", "role", "range", "actor", "entity"] as const) {
    const value = next[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

function apiQuery(filters: DevLogFilters, extra: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/api/admin/activity?${params.toString()}`;
}

interface Props {
  initial: DevLogPage;
  filters: DevLogFilters;
  /** Design preview: sample data, no network. */
  preview?: boolean;
}

export function DevLogView({ initial, filters, preview = false }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<DevLogEntry[]>(initial.entries);
  const [labels, setLabels] = useState<DevLogLabels>(initial.labels);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [today, setToday] = useState<string | null>(null);
  const lastPoll = useRef(0);

  // "Today" and "Yesterday" depend on the reader's clock, so they are worked
  // out after mount; the server and first client render both show full dates.
  useEffect(() => {
    setToday(dayKey.format(new Date()));
  }, []);

  const newest = entries[0]?.at ?? null;

  // New-events notice. Counts only, visible tab only, at most once a minute.
  useEffect(() => {
    if (preview || !newest) return;
    let cancelled = false;
    async function check() {
      if (document.visibilityState !== "visible" || Date.now() - lastPoll.current < POLL_MS - 1000) return;
      lastPoll.current = Date.now();
      try {
        const res = await fetch(apiQuery(filters, { since: newest! }), { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { count?: number };
        if (!cancelled) setNewCount(body.count ?? 0);
      } catch {
        // A missed poll is harmless; the next one catches up.
      }
    }
    lastPoll.current = Date.now();
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [preview, newest, filters]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loading || preview) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiQuery(filters, { cursor }), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as DevLogPage;
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.entries.filter((e) => !seen.has(e.id))];
      });
      setLabels((prev) => ({
        people: { ...prev.people, ...page.labels.people },
        pages: { ...prev.pages, ...page.labels.pages },
        vehicles: { ...prev.vehicles, ...page.labels.vehicles },
      }));
      setCursor(page.nextCursor);
    } catch {
      setLoadError("Older events could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, preview, filters]);

  const groups = useMemo(() => {
    const out: { key: string; items: DevLogEntry[] }[] = [];
    for (const entry of entries) {
      const key = dayKey.format(new Date(entry.at));
      const group = out[out.length - 1];
      if (group && group.key === key) group.items.push(entry);
      else out.push({ key, items: [entry] });
    }
    return out;
  }, [entries]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const header = ["time_utc", "time_sri_lanka", "actor", "actor_role", "action", "event_type", "subject_kind", "subject", "subject_id", "booking_id", "details"];
    const rows = entries.map((e) => [
      e.at,
      `${dayKey.format(new Date(e.at))} ${clock.format(new Date(e.at))}`,
      actorName(e),
      actorRoleLabel(e.role),
      eventPhrase(e.type).phrase,
      e.type,
      e.subjectKind,
      subjectLabel(e, labels) ?? "",
      e.subjectId,
      e.bookingId ?? "",
      e.meta ? JSON.stringify(e.meta) : "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `drivelink-dev-log-${dayKey.format(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeCount = Object.values(filters).filter(Boolean).length;
  const actorFilterName = filters.actor ? entries.find((e) => e.actorId === filters.actor)?.actorName ?? "one person" : null;
  const entityFilterName = filters.entity ? entityName(filters.entity, entries, labels) : null;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Dev log"
        description="Every recorded action on DriveLink, newest first: what happened, who did it and when (Sri Lanka time)."
        actions={
          <>
            <button type="button" onClick={() => router.refresh()} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
            <button type="button" onClick={exportCsv} disabled={entries.length === 0} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Download size={15} aria-hidden="true" /> Export CSV
            </button>
          </>
        }
      />

      {/* Filters. Links, not state: a filtered view is a URL the server
          renders, can be bookmarked, and survives a refresh. */}
      <div className="space-y-3">
        <div className="scrollbar-none mask-fade-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href={hrefWith(filters, { category: undefined })} className={chipClasses(!filters.category)}>All actions</Link>
          {DEV_LOG_CATEGORIES.map((c) => (
            <Link key={c.value} href={hrefWith(filters, { category: c.value })} className={chipClasses(filters.category === c.value)}>
              {c.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented
            label="Who"
            options={[{ value: undefined, label: "Anyone" }, ...DEV_LOG_ROLES.map((r) => ({ value: r.value as string, label: r.label }))]}
            current={filters.role}
            href={(value) => hrefWith(filters, { role: value })}
          />
          <Segmented
            label="When"
            options={[{ value: undefined, label: "All time" }, ...DEV_LOG_RANGES.map((r) => ({ value: r.value as string, label: r.label }))]}
            current={filters.range}
            href={(value) => hrefWith(filters, { range: value })}
          />
        </div>
        {(actorFilterName || entityFilterName || activeCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {actorFilterName && (
              <Link href={hrefWith(filters, { actor: undefined })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 font-medium text-blue-800 ring-1 ring-inset ring-blue-600/15 hover:bg-blue-100">
                Done by {actorFilterName} <X size={14} aria-label="Remove" />
              </Link>
            )}
            {entityFilterName && (
              <Link href={hrefWith(filters, { entity: undefined })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 font-medium text-blue-800 ring-1 ring-inset ring-blue-600/15 hover:bg-blue-100">
                About {entityFilterName} <X size={14} aria-label="Remove" />
              </Link>
            )}
            {activeCount > 0 && (
              <Link href={BASE} className="min-h-9 px-2 font-medium text-slate-500 hover:text-slate-900">Clear all filters</Link>
            )}
          </div>
        )}
      </div>

      {newCount > 0 && (
        <div className="sticky top-16 z-20 flex justify-center md:top-4">
          <button
            type="button"
            onClick={() => { setNewCount(0); router.refresh(); }}
            className="animate-scale-in inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg hover:bg-slate-800"
          >
            <Activity size={15} aria-hidden="true" />
            {newCount} new {newCount === 1 ? "event" : "events"}. Show
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={22} strokeWidth={1.5} />}
          title={activeCount ? "Nothing matches these filters" : "Nothing recorded yet"}
          description={activeCount ? "Try a wider time range or a different kind of action." : "Actions appear here as soon as they happen."}
          action={activeCount ? <Link href={BASE} className={buttonClasses({ variant: "secondary" })}>Clear filters</Link> : undefined}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} aria-label={dayLabel.format(dateFromKey(group.key))}>
              <h2 className="sticky top-14 z-10 -mx-1 mb-2 bg-canvas/90 px-1 py-2 text-sm font-semibold text-slate-900 backdrop-blur md:top-0">
                <span suppressHydrationWarning>{relativeDay(group.key, today) ?? dayLabel.format(dateFromKey(group.key))}</span>
                <span className="ml-2 font-normal text-slate-400">{group.items.length} {group.items.length === 1 ? "event" : "events"}</span>
              </h2>
              <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.06]">
                {group.items.map((entry) => (
                  <EventRow
                    key={entry.id}
                    entry={entry}
                    labels={labels}
                    filters={filters}
                    expanded={open.has(entry.id)}
                    onToggle={() => toggle(entry.id)}
                  />
                ))}
              </ol>
            </section>
          ))}

          <div className="flex flex-col items-center gap-2 pb-4">
            {cursor ? (
              <button type="button" onClick={loadOlder} disabled={loading || preview} className={buttonClasses({ variant: "secondary", size: "lg" })}>
                {loading ? "Loading older events" : "Load older events"}
              </button>
            ) : (
              <p className="text-sm text-slate-400">That is the earliest recorded event{activeCount ? " for these filters" : ""}.</p>
            )}
            {loadError && <p role="alert" className="text-sm text-rose-700">{loadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ entry, labels, filters, expanded, onToggle }: {
  entry: DevLogEntry; labels: DevLogLabels; filters: DevLogFilters; expanded: boolean; onToggle: () => void;
}) {
  const category = eventCategory(entry.type);
  const Icon = CATEGORY_ICON[category] ?? Activity;
  const { phrase, tone } = eventPhrase(entry.type);
  const subject = subjectLabel(entry, labels);
  const role = entry.role ?? "system";
  const meta = entry.meta ? Object.entries(entry.meta).filter(([, v]) => v !== null && v !== "") : [];

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/70 sm:items-center sm:gap-4"
      >
        <time dateTime={entry.at} className="w-16 shrink-0 pt-0.5 text-xs font-medium tabular text-slate-400 sm:pt-0">
          {clock.format(new Date(entry.at))}
        </time>
        <span className={`hidden h-8 w-8 shrink-0 place-items-center rounded-full sm:grid ${TONE[tone]}`} aria-hidden="true">
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1 text-sm leading-6 text-slate-700">
          <strong className="font-semibold text-slate-950">{actorName(entry)}</strong>{" "}
          {phrase}
          {subject && <> <span className="text-slate-400">·</span> <span className="font-medium text-slate-900">{subject}</span></>}
        </span>
        <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset sm:inline ${ROLE_BADGE[role] ?? ROLE_BADGE.system}`}>
          {actorRoleLabel(role)}
        </span>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-slate-400 transition-transform sm:mt-0 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="animate-fade-in space-y-4 bg-slate-50/60 px-4 pb-4 pt-1 sm:pl-[7.25rem]">
          {meta.length > 0 && (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {meta.map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-xs text-slate-500">{META_LABELS[key] ?? key.replace(/_/g, " ")}</dt>
                  <dd className="break-words font-medium text-slate-900">{formatMeta(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <div><dt className="text-slate-500">Event code</dt><dd className="font-mono text-slate-700">{entry.type}</dd></div>
            <div><dt className="text-slate-500">Recorded at (UTC)</dt><dd className="font-mono text-slate-700">{entry.at}</dd></div>
            <div className="min-w-0"><dt className="text-slate-500">Event id</dt><dd className="truncate font-mono text-slate-700">{entry.id}</dd></div>
            {entry.bookingId && (
              <div><dt className="text-slate-500">Booking</dt><dd className="font-mono text-slate-700">{entry.bookingId.slice(0, 8).toUpperCase()}</dd></div>
            )}
          </dl>
          <div className="flex flex-wrap gap-2">
            {entry.actorId && filters.actor !== entry.actorId && (
              <Link href={hrefWith(filters, { actor: entry.actorId })} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Everything {actorName(entry)} did
              </Link>
            )}
            {entityLinks(entry, labels, filters).map((link) => (
              <Link key={link.href} href={link.href} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function Segmented({ label, options, current, href }: {
  label: string;
  options: { value: string | undefined; label: string }[];
  current: string | undefined;
  href: (value: string | undefined) => string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="scrollbar-none flex overflow-x-auto rounded-xl bg-slate-100 p-1">
        {options.map((option) => {
          const active = option.value === current;
          return (
            <Link
              key={option.label}
              href={href(option.value)}
              aria-current={active ? "true" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-white font-semibold text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function actorName(entry: DevLogEntry): string {
  if (entry.actorName) return entry.actorName;
  if (!entry.role || entry.role === "system") return "DriveLink (system)";
  return `A ${actorRoleLabel(entry.role).toLowerCase()}`;
}

function subjectLabel(entry: DevLogEntry, labels: DevLogLabels): string | null {
  switch (entry.subjectKind) {
    case "renter": {
      // "Ayesha created an account" needs no subject repeating Ayesha.
      if (entry.subjectId === entry.actorId) return null;
      return labels.people[entry.subjectId] ?? "an account";
    }
    case "agency": return labels.pages[entry.subjectId]?.name ?? (typeof entry.meta?.name === "string" ? entry.meta.name : null);
    case "vehicle": return labels.vehicles[entry.subjectId]?.name ?? (typeof entry.meta?.name === "string" ? entry.meta.name : null);
    case "booking": return `Booking ${entry.subjectId.slice(0, 8).toUpperCase()}`;
    default: return null;
  }
}

function entityLinks(entry: DevLogEntry, labels: DevLogLabels, filters: DevLogFilters): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  const add = (href: string, label: string) => { if (!out.some((l) => l.href === href)) out.push({ href, label }); };
  if (entry.bookingId && filters.entity !== entry.bookingId) {
    add(hrefWith(filters, { entity: entry.bookingId, actor: undefined }), `Everything about booking ${entry.bookingId.slice(0, 8).toUpperCase()}`);
  }
  if (entry.subjectKind === "vehicle") {
    if (filters.entity !== entry.subjectId) add(hrefWith(filters, { entity: entry.subjectId, actor: undefined }), "Everything about this listing");
    const slug = labels.vehicles[entry.subjectId]?.slug;
    if (slug) add(`/vehicles/${slug}`, "Open the listing");
  }
  const pageId = entry.subjectKind === "agency" ? entry.subjectId : entry.agencyId;
  if (pageId) {
    if (filters.entity !== pageId) add(hrefWith(filters, { entity: pageId, actor: undefined }), `Everything about ${labels.pages[pageId]?.name ?? "this Rental Page"}`);
    add(`/admin/agencies/${pageId}/timeline`, "Rental Page timeline");
  }
  const personId = entry.subjectKind === "renter" ? entry.subjectId : entry.renterId;
  if (personId) add(`/admin/users/${personId}/timeline`, `${labels.people[personId] ?? "Account"} timeline`);
  return out;
}

function entityName(id: string, entries: DevLogEntry[], labels: DevLogLabels): string {
  if (labels.pages[id]) return labels.pages[id].name;
  if (labels.vehicles[id]) return labels.vehicles[id].name;
  if (labels.people[id]) return labels.people[id];
  if (entries.some((e) => e.bookingId === id || (e.subjectKind === "booking" && e.subjectId === id))) {
    return `booking ${id.slice(0, 8).toUpperCase()}`;
  }
  return "one record";
}

function formatMeta(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("en-LK");
  if (typeof value === "string") return value.replace(/_/g, " ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

function dateFromKey(key: string): Date {
  // Noon UTC, so the formatted day cannot slip across midnight in Colombo.
  return new Date(`${key}T12:00:00Z`);
}

function relativeDay(key: string, today: string | null): string | null {
  if (!today) return null;
  if (key === today) return "Today";
  const yesterday = dayKey.format(new Date(dateFromKey(today).getTime() - 24 * 3600_000));
  return key === yesterday ? "Yesterday" : null;
}
