"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Share, SquarePlus } from "lucide-react";

/**
 * "Add to home screen", offered on the homepage.
 *
 * It cannot fire on its own, and that is a browser rule rather than an
 * oversight. Chrome only lets prompt() run inside a real tap, so calling it on
 * load throws; iOS Safari has no install API at all and the only route is the
 * Share menu. Sites abused automatic prompts and the platforms closed it.
 *
 * So this appears by itself and installs in a single tap, which is as close to
 * automatic as the platforms permit:
 *
 *   Android and desktop Chrome  the real prompt, one tap
 *   iOS Safari                  the two steps, since nothing else is possible
 *
 * It stays quiet when it would be noise: already installed, running as an
 * installed app, on a desktop, or dismissed recently. A prompt that reappears
 * on every visit trains people to close it without reading.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  // Parked by the inline snippet in the root layout, which runs long before
  // React does. Without it the event is simply gone by the time we listen.
  interface Window { __dlInstallEvent?: BeforeInstallPromptEvent | null }
}

const DISMISS_KEY = "drivelink-install-dismissed";
// Long enough that a "no" is respected, short enough that someone who is now a
// regular gets asked again.
const ASK_AGAIN_AFTER_DAYS = 30;
// Let the page settle first. Arriving to a banner before the page has drawn
// reads as an ad.
const APPEAR_AFTER_MS = 4000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (!at) return false;
    return Date.now() - at < ASK_AGAIN_AFTER_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function alreadyInstalled(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS reports it here instead, and only on the Safari that installed it.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iOS gets no install event, so it is detected rather than waited for. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua)
    // iPadOS 13+ reports as a Mac, but a Mac has no touch.
    || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  // Every iOS browser is WebKit, but only Safari has Add to Home Screen.
  return !/crios|fxios|edgios|opios/i.test(ua);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (alreadyInstalled() || recentlyDismissed()) return;
    // A phone affordance. A banner over a desktop homepage is just clutter.
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    let timer: number | undefined;

    const onBeforeInstall = (event: Event) => {
      // Without this Chrome shows its own mini-infobar and ours never gets a
      // turn, so the event has to be claimed before it is used.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      timer = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // The usual case on Chrome: it already fired, and the layout caught it.
    const parked = window.__dlInstallEvent;
    if (parked) {
      setDeferred(parked);
      timer = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS);
    }

    if (isIosSafari()) {
      setShowIosSteps(true);
      timer = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch { /* the browser withdrew it; nothing useful to say */ }
    // Chrome allows one prompt per event, so it cannot be offered again.
    window.__dlInstallEvent = null;
    setDeferred(null);
    setVisible(false);
    setBusy(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Add DriveLink to your home screen"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:hidden"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <Image
          src="/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">Add DriveLink to your home screen</p>
          <p className="mt-0.5 text-sm leading-snug text-slate-600">
            Open it like an app, and keep your bookings one tap away.
          </p>
        </div>
      </div>

      {showIosSteps ? (
        <ol className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <Share size={16} className="shrink-0 text-blue-600" aria-hidden="true" />
            Tap the Share button in Safari&apos;s toolbar
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus size={16} className="shrink-0 text-blue-600" aria-hidden="true" />
            Choose <strong className="font-semibold">Add to Home Screen</strong>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={install}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Opening…" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
