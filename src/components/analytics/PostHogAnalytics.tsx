"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { PostHog } from "posthog-js";
import { isTrafficAnalyticsEnabled } from "@/lib/analytics/client";

/**
 * PostHog, alongside the first-party traffic tables rather than instead of them.
 *
 * The database analytics answer "how many" and feed the admin screen. PostHog
 * answers "why": session replay of an owner getting stuck in the listing
 * wizard, and funnels that do not need a migration every time a step changes.
 *
 * Four things here are deliberate and easy to get wrong:
 *
 *   1. Traffic goes through /rly on our own domain, not to posthog.com. Every
 *      major blocklist carries PostHog's ingest domains, so a direct setup
 *      quietly loses a large slice of real visitors while the numbers still
 *      look plausible.
 *   2. It obeys the same privacy gate as the first-party analytics, so Global
 *      Privacy Control, Do Not Track and the account toggle turn off both.
 *      One switch, or the switch is a lie.
 *   3. Recording is refused outright on any page that can show identity
 *      documents. Masking is not enough there: a licence photo is an <img>,
 *      and input masking does nothing about an image.
 *   4. The runtime is the script build fetched from our own proxy rather than
 *      the bundled npm module. Same-origin means a blocklist cannot drop it,
 *      and because only the TYPES come from the package, and types are erased
 *      at compile time, the library adds nothing to the JavaScript bundle.
 */

// Anything that can render a licence, an NIC, or a KYC decision. Replay and
// autocapture are both shut off here, not merely masked.
const NEVER_RECORD = [
  "/account/documents",
  "/account/settings",
  "/documents",
  "/kyc",
  "/admin/renters",
  "/admin/slips",
];

function isSensitive(path: string): boolean {
  return NEVER_RECORD.some((fragment) => path.includes(fragment));
}

declare global {
  interface Window { posthog?: PostHog }
}

let client: PostHog | null = null;
let starting = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(tag);
  });
}

export function PostHogAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(client !== null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || client || starting || !isTrafficAnalyticsEnabled()) return;
    starting = true;

    // Deliberately NOT aborted on unmount. React runs effects twice in
    // development, so a cleanup that cancelled the in-flight load left the
    // second run blocked by `starting` and the first run refusing to finish:
    // PostHog then never initialised at all. Setting up a global analytics
    // client is idempotent and safe to complete regardless.
    loadScript("/rly/static/array.js")
      .then(() => {
        const posthog = window.posthog;
        if (!posthog) { starting = false; return; }

        posthog.init(key, {
          api_host: "/rly",
          // Only used to build "view in PostHog" links, never for traffic.
          ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",

          // App Router changes the URL without a load event, so PostHog's own
          // detection fires once and never again. The effect below sends them.
          capture_pageview: false,
          capture_pageleave: true,

          // A person profile per anonymous visitor burns the free allowance
          // for nothing. Only people who sign in get one.
          person_profiles: "identified_only",

          respect_dnt: true,
          disable_session_recording: isSensitive(window.location.pathname),

          session_recording: {
            maskAllInputs: true,
            maskTextSelector: "[data-private], .ph-mask",
            blockSelector: "img[data-document], [data-private-block]",
          },
        });

        client = posthog;
        setReady(true);
      })
      .catch(() => { starting = false; });
  }, []);

  // One pageview per navigation, with the query string, since the search page
  // keeps its filters there and they are the interesting part.
  useEffect(() => {
    if (!ready || !client || !pathname) return;

    if (isSensitive(pathname)) client.stopSessionRecording?.();
    else client.startSessionRecording?.();

    const query = searchParams?.toString();
    client.capture("$pageview", {
      $current_url: window.location.origin + pathname + (query ? `?${query}` : ""),
    });
  }, [ready, pathname, searchParams]);

  return null;
}

/**
 * Attach a signed-in identity, so a funnel can follow one owner across
 * sessions. Safe to call when PostHog is off; it simply does nothing.
 */
export function identifyForAnalytics(userId: string, traits?: Record<string, unknown>): void {
  client?.identify(userId, traits);
}

/** Drop the identity on sign-out, so the next person on a shared phone is not them. */
export function resetAnalyticsIdentity(): void {
  client?.reset();
}
