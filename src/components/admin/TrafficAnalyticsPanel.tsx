"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, BookOpen, CarFront, Eye, ExternalLink, MousePointerClick, UsersRound } from "lucide-react";
import { HelpHint } from "@/components/ui/HelpHint";
import { Sparkline } from "@/components/analytics/Sparkline";
import type { TrafficRangeKey, TrafficSnapshot } from "@/lib/analytics/traffic";

interface Props {
  initial: TrafficSnapshot;
  range: TrafficRangeKey;
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct / saved link",
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  campaign: "Tagged campaign",
  other_referral: "Other website",
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Viewed page",
  vehicle_view: "Viewed vehicle",
  booking_form_view: "Opened booking form",
  booking_request_started: "Started booking request",
  booking_request_submitted: "Sent booking request",
  guide_opened: "Opened guide",
  search_submitted: "Searched vehicles",
};

// Both systems record every page view, and they will not agree. The numbers
// on this page are written by our own server when the request arrives, so a
// blocker cannot remove them. PostHog is a script in the browser, so ad
// blockers and privacy modes cut into its totals. Anyone comparing the two
// deserves to be told which one to believe rather than left to guess.
const COUNTING_NOTE =
  "These figures and PostHog's will not match, and that is expected. This page is counted by our own server as each request arrives, so nothing can block it. PostHog counts from a script in the visitor's browser, which ad blockers and privacy settings stop, so its totals read lower. Where the two disagree, trust the numbers on this page.";

// Public, and only used to build an outbound link.
const POSTHOG_URL = (() => {
  const host = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST;
  const project = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID;
  if (!host || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  return project ? `${host}/project/${project}` : host;
})();

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function TrafficAnalyticsPanel({ initial, range }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [shownRange, setShownRange] = useState(range);
  const [error, setError] = useState<string | null>(null);

  // Picking a different range re-renders the page on the server and hands this
  // component the numbers for that range. But useState only reads its argument
  // on the first mount, so the panel went on showing the previous range's
  // figures until a poll happened to land, up to twenty seconds later, which
  // made the range buttons look like they did nothing. Adjusting state during
  // render is React's own answer for state that has to follow a prop: it
  // re-renders immediately, before the browser paints the stale numbers.
  if (range !== shownRange) {
    setShownRange(range);
    setSnapshot(initial);
  }

  // Keeps the figures live without anyone pressing anything. The stale guard
  // matters because a request issued for the old range can still be in flight
  // when the range changes, and it must not overwrite the new range's numbers.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/admin/analytics/traffic?range=${range}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Live numbers could not be refreshed.");
        if (cancelled) return;
        setSnapshot(body.snapshot);
        setError(null);
      } catch (pollError) {
        if (cancelled) return;
        setError(pollError instanceof Error ? pollError.message : "Live numbers could not be refreshed.");
      }
    }

    const timer = window.setInterval(poll, 20_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [range]);

  const funnelMax = Math.max(snapshot.vehicle_views, snapshot.booking_starts, snapshot.booking_requests, 1);
  const dailyViews = useMemo(() => snapshot.daily.map((day) => day.views), [snapshot.daily]);

  return (
    <section aria-labelledby="traffic-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-blue-600" aria-hidden="true" />
            <h2 id="traffic-heading" className="text-lg font-semibold tracking-tight text-slate-900">Traffic and customer journeys</h2>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            First-party activity only. Live means active within the last five minutes.
            <HelpHint text={COUNTING_NOTE} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
            Updates every 20 seconds
          </p>
          {POSTHOG_URL && (
            <a
              href={POSTHOG_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:bg-slate-50"
            >
              View in PostHog
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-rose-200">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Metric label="Live now" value={snapshot.active_now} Icon={Activity} live />
        <Metric label="Signed in now" value={snapshot.signed_in_now} Icon={UsersRound} />
        <Metric label="Visitors" value={snapshot.visitors} Icon={UsersRound} />
        <Metric label="Page views" value={snapshot.page_views} Icon={Eye} />
        <Metric label="Vehicle views" value={snapshot.vehicle_views} Icon={CarFront} />
        <Metric label="Booking starts" value={snapshot.booking_starts} Icon={MousePointerClick} />
        <Metric label="Requests sent" value={snapshot.booking_requests} Icon={ArrowDownRight} />
        <Metric label="Guides opened" value={snapshot.guide_plays} Icon={BookOpen} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.6fr)]">
        <div className="rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-900/[0.06]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Daily visits</h3>
            <span className="text-xs text-slate-500">{snapshot.daily.length} days</span>
          </div>
          {dailyViews.length ? (
            <>
              <Sparkline values={dailyViews} width={800} height={92} className="h-24 w-full" />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{snapshot.daily[0]?.day}</span><span>{snapshot.daily.at(-1)?.day}</span>
              </div>
            </>
          ) : <Empty text="Traffic will appear after the first recorded visit." />}
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-900/[0.06]">
          <h3 className="text-sm font-semibold text-slate-900">Vehicle-to-request journey</h3>
          <div className="mt-4 space-y-3">
            <JourneyRow label="Vehicle views" value={snapshot.vehicle_views} max={funnelMax} />
            <JourneyRow label="Booking started" value={snapshot.booking_starts} max={funnelMax} />
            <JourneyRow label="Request sent" value={snapshot.booking_requests} max={funnelMax} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TableSection title="Where visitors came from" headers={["Source", "Visitors"]} empty="No source data yet.">
          {snapshot.sources.map((row) => <TableRow key={row.source} cells={[SOURCE_LABELS[row.source] ?? row.source, row.visitors.toLocaleString("en-LK")]} />)}
        </TableSection>
        <TableSection title="Devices" headers={["Device", "Visitors"]} empty="No device data yet.">
          {snapshot.devices.map((row) => <TableRow key={row.device} cells={[row.device.replace(/^./, (letter) => letter.toUpperCase()), row.visitors.toLocaleString("en-LK")]} />)}
        </TableSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TableSection title="Most visited pages" headers={["Page", "Views"]} empty="No page views yet.">
          {snapshot.top_paths.map((row) => <TableRow key={row.path} cells={[row.path, row.views.toLocaleString("en-LK")]} mono />)}
        </TableSection>
        <TableSection title="Most viewed vehicles" headers={["Vehicle", "Views"]} empty="No vehicle views yet.">
          {snapshot.top_vehicles.map((row) => <TableRow key={row.id} cells={[row.label ?? row.id, row.views.toLocaleString("en-LK")]} />)}
        </TableSection>
      </div>

      <div className="rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.06]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Recent journey activity</h3>
          <span className="text-xs text-slate-500">Anonymous visitor labels</span>
        </div>
        {snapshot.recent.length === 0 ? <Empty text="Recent journey steps will appear here." /> : (
          <div className="max-h-[30rem] overflow-auto">
            {snapshot.recent.map((event) => (
              <div key={event.id} className="grid grid-cols-[minmax(7rem,.8fr)_minmax(0,1.7fr)_auto] gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0">
                <div>
                  <p className="font-semibold text-slate-800">Visitor {event.visitor}</p>
                  <p className="mt-0.5 text-slate-500">{event.signed_in ? "Signed in" : "Visitor"} &middot; {event.device}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{EVENT_LABELS[event.event_name] ?? event.event_name}</p>
                  <p className="mt-0.5 truncate text-slate-500">{event.label ?? event.path}</p>
                </div>
                <div className="text-right text-slate-500">
                  <p suppressHydrationWarning>{relativeTime(event.created_at)}</p>
                  <p className="mt-0.5">{SOURCE_LABELS[event.source] ?? event.source}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, Icon, live = false }: { label: string; value: number; Icon: typeof Activity; live?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3.5 shadow-xs ring-1 ring-slate-900/[0.06] sm:min-h-24">
      <div className="flex items-start justify-between gap-2 text-slate-500">
        <span className="text-xs font-medium leading-tight">{label}</span>
        <Icon size={14} className={`shrink-0 ${live && value > 0 ? "text-emerald-600" : "text-slate-400"}`} aria-hidden="true" />
      </div>
      <p className="tabular mt-2 text-xl font-semibold text-slate-950">{value.toLocaleString("en-LK")}</p>
    </div>
  );
}

function JourneyRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="tabular font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function TableSection({ title, headers, empty, children }: { title: string; headers: string[]; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/[0.06]">
      <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-slate-50/80 px-4 py-2 text-xs font-medium text-slate-500">
        <span>{headers[0]}</span><span>{headers[1]}</span>
      </div>
      {hasChildren ? <div className="divide-y divide-slate-100">{children}</div> : <Empty text={empty} />}
    </div>
  );
}

function TableRow({ cells, mono = false }: { cells: [string, string]; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-2.5 text-xs">
      <span className={`truncate text-slate-700 ${mono ? "font-mono" : ""}`}>{cells[0]}</span>
      <span className="tabular font-semibold text-slate-900">{cells[1]}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-xs text-slate-500">{text}</p>;
}
