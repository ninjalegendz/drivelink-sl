/*
 * DriveLink service worker.
 * Purpose: make the app installable (PWA) and resilient when offline, WITHOUT
 * ever serving stale authenticated HTML. Strategy:
 *   - navigations (HTML)      -> network-first, fall back to /offline.html
 *   - hashed static assets    -> cache-first (immutable, content-hashed)
 *   - everything else         -> straight to network (API, Supabase, R2, etc.)
 */
// Bump this on any change to precached/cache-first assets (icons, logos) - 
// `activate` deletes every cache whose key doesn't start with VERSION, so
// returning visitors drop stale copies instead of keeping them forever.
const VERSION = "dl-sw-v6";
const STATIC_CACHE = `${VERSION}-static`;
// Next strips the .html extension, so the canonical 200 URL is /offline.
// Precaching /offline.html would 307-redirect and make install fail.
const OFFLINE_URL = "/offline";

// Poppins faces used by /offline are precached too - otherwise the offline
// page would fall back to a system font, which the brand doesn't allow.
const PRECACHE = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/fonts/Poppins-Regular.woff2",
  "/fonts/Poppins-Bold.woff2",
  "/fonts/Poppins-ExtraBold.woff2",
];

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

function isSensitiveRequest(url) {
  return (
    url.pathname.startsWith("/api/docs/")
    || url.pathname.includes("/evidence-pack")
    || url.pathname.includes("/agreement/pdf")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only ever touch same-origin GETs. Auth, Supabase, R2 and any POST/PUT
  // pass straight through to the network untouched.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // These responses contain identity, agreement, or booking evidence. Never
  // let the image-extension cache rule below retain them, even when a protected
  // URL ends in .jpg or .png. The v6 activation also removes every v5 cache.
  if (isSensitiveRequest(url)) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

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
