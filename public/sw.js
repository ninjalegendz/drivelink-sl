/*
 * DriveLink service worker.
 * Purpose: make the app installable (PWA) and resilient when offline, WITHOUT
 * ever serving stale authenticated HTML. Strategy:
 *   - navigations (HTML)      -> network-first, fall back to /offline.html
 *   - hashed static assets    -> cache-first (immutable, content-hashed)
 *   - everything else         -> straight to network (API, Supabase, R2, etc.)
 */
const VERSION = "dl-sw-v3";
const STATIC_CACHE = `${VERSION}-static`;
// Next strips the .html extension, so the canonical 200 URL is /offline.
// Precaching /offline.html would 307-redirect and make install fail.
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isHashedStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|gif|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only ever touch same-origin GETs. Auth, Supabase, R2 and any POST/PUT
  // pass straight through to the network untouched.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for page navigations; offline page as the safety net.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first for immutable hashed assets, with background refresh.
  if (isHashedStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          return cached || Response.error();
        }
      })()
    );
  }
});
