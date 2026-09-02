export type TrafficEventName =
  | "page_view"
  | "vehicle_view"
  | "booking_form_view"
  | "booking_request_started"
  | "booking_request_submitted"
  | "guide_opened"
  | "search_submitted";

export interface TrafficEventInput {
  event: TrafficEventName;
  path?: string;
  entityType?: "vehicle" | "rental_page" | "guide" | "search";
  entityId?: string;
  label?: string;
}

const OPT_OUT_KEY = "drivelink-analytics-opt-out";

function browserRequestsPrivacy(): boolean {
  if (typeof window === "undefined") return true;
  const navigatorWithGpc = navigator as Navigator & { globalPrivacyControl?: boolean };
  let locallyDisabled = false;
  try { locallyDisabled = localStorage.getItem(OPT_OUT_KEY) === "1"; } catch {}
  return navigatorWithGpc.globalPrivacyControl === true
    || navigator.doNotTrack === "1"
    || locallyDisabled;
}

export function isTrafficAnalyticsEnabled(): boolean {
  return !browserRequestsPrivacy();
}

/**
 * Why analytics are off, so the preference control can say something true.
 *
 * A browser sending Global Privacy Control or Do Not Track overrides the local
 * choice, and it must: those signals are the whole point. But the toggle used
 * to read only isTrafficAnalyticsEnabled(), so on such a browser it showed a
 * switch that snapped straight back to off every time it was pressed, with no
 * explanation. Now the control can disable itself and say which signal did it.
 */
export function trafficAnalyticsState(): {
  enabled: boolean;
  forcedOffBySignal: null | "gpc" | "dnt";
} {
  if (typeof window === "undefined") return { enabled: false, forcedOffBySignal: null };
  const navigatorWithGpc = navigator as Navigator & { globalPrivacyControl?: boolean };
  const forcedOffBySignal = navigatorWithGpc.globalPrivacyControl === true
    ? "gpc"
    : navigator.doNotTrack === "1"
      ? "dnt"
      : null;
  return { enabled: isTrafficAnalyticsEnabled(), forcedOffBySignal };
}

export function setTrafficAnalyticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, "1");
  } catch {}
  window.dispatchEvent(new CustomEvent("drivelink:analytics-preference"));
}

export function trackTrafficEvent(input: TrafficEventInput): void {
  if (!isTrafficAnalyticsEnabled()) return;

  const payload = JSON.stringify({
    ...input,
    path: input.path ?? window.location.pathname,
    referrer: document.referrer || null,
    campaign: {
      source: new URLSearchParams(window.location.search).get("utm_source"),
      medium: new URLSearchParams(window.location.search).get("utm_medium"),
      name: new URLSearchParams(window.location.search).get("utm_campaign"),
    },
  });

  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function sendTrafficHeartbeat(): void {
  if (!isTrafficAnalyticsEnabled() || document.visibilityState !== "visible") return;
  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "heartbeat", path: window.location.pathname }),
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}
