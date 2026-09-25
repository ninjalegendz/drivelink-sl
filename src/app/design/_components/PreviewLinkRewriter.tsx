"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps a reviewer inside the preview area.
//
// The real screens rendered under /design link to the real signed-in routes
// (/admin/..., /dashboard/..., /account/..., /bookings/...). Clicked from a
// preview, those bounce to the login page, which reads as a dead link. This
// catches those clicks and sends them to the preview that mirrors the route:
//
//   /admin/users                  ->  /design/admin/users
//   /admin/users/<uuid>/timeline  ->  /design/admin/users/sample/timeline
//   /bookings/<uuid>              ->  /design/bookings/sample
//
// Previews mirror the real paths with every id replaced by "sample", so the
// rule needs no list to maintain. Public routes (/, /vehicles, /pages/...)
// are left alone; they already work without an account. Modified clicks
// (new tab, etc.) keep the browser's default.

const PRIVATE_ROOTS = ["/admin", "/dashboard", "/account", "/bookings"];
const ID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function previewHref(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const path = url.pathname;
  if (!PRIVATE_ROOTS.some((root) => path === root || path.startsWith(root + "/"))) return null;
  const mirrored = path
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? "sample" : segment))
    .join("/");
  return `/design${mirrored}${url.search}${url.hash}`;
}

export function PreviewLinkRewriter() {
  const router = useRouter();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      const next = previewHref(anchor.getAttribute("href") ?? "");
      if (!next) return;
      event.preventDefault();
      router.push(next);
    }
    // Capture phase, so it runs before Next's own <Link> handler navigates.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
