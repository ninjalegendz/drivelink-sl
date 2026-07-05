"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (/sw.js) once, after the window loads, so it
 * never competes with first paint. Rendered once from the root layout. The SW
 * itself is conservative (see public/sw.js) — it won't cache authed HTML.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Non-fatal: the app works fine without the SW, just not installable.
          console.warn("[pwa] service worker registration failed", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
