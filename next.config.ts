import type { NextConfig } from "next";

// PostHog ingest and asset hosts. Traffic is proxied through /rly on our own
// domain because every major blocklist carries these two names directly, and a
// blocked analytics call looks exactly like a visitor who never arrived.
const POSTHOG_INGEST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_ASSETS = process.env.NEXT_PUBLIC_POSTHOG_ASSET_HOST || "https://us-assets.i.posthog.com";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  // PostHog's endpoints are sensitive to a trailing slash being added by a
  // redirect, which silently drops the batch.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return {
      // The /design review area is dev-only. Its pages already call
      // notFound() in production, but the root loading.tsx starts streaming
      // before they run, so the 404 page went out with a 200 status. Sending
      // it to a route that does not exist, before the filesystem is checked,
      // answers a real 404 and never renders a preview component at all.
      beforeFiles: process.env.NODE_ENV === "production"
        ? [
            { source: "/design", destination: "/__design-preview-unavailable" },
            { source: "/design/:path*", destination: "/__design-preview-unavailable" },
          ]
        : [],
      afterFiles: [
        { source: "/rly/static/:path*", destination: `${POSTHOG_ASSETS}/static/:path*` },
        { source: "/rly/:path*", destination: `${POSTHOG_INGEST}/:path*` },
      ],
      fallback: [],
    };
  },
  async headers() {
    // Next's local refresh runtime uses eval. Keep the production browser
    // policy strict without making local development silently lose refresh.
    if (process.env.NODE_ENV !== "production") return [];

    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co https://*.r2.dev https://*.r2.cloudflarestorage.com https://cdn.drivelink.lk https://images.unsplash.com https://cdn.dribbble.com",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "font-src 'self' data:",
      // R2 belongs here as well as in img-src: uploads are a direct browser PUT
      // to a presigned URL on the S3 endpoint, which is a connect-src fetch,
      // not an image load. Without it every photo upload on the site failed
      // with a bare network error, and because this policy is only applied
      // when NODE_ENV is production, no test running against `next dev` could
      // ever see it.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://*.r2.dev https://cdn.drivelink.lk https://verification.didit.me https://cloudflareinsights.com",
      "frame-src https://www.youtube-nocookie.com",
      // The replay recorder is fetched from /rly/static and started as a blob
      // worker, which worker-src already allows.
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      ],
    }];
  },
  images: {
    // Next's built-in optimiser needs a Node runtime we do not have on Workers,
    // which is why every <Image> was marked `unoptimized` and full-size phone
    // photos went straight to people on mobile data. This hands resizing to
    // Cloudinary, which fetches the original from R2 and caches the result.
    // With no cloud name configured the loader returns the source untouched,
    // so an unconfigured deploy behaves exactly as before.
    loader: "custom",
    loaderFile: "./src/lib/images/cloudinary-loader.ts",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Legacy: existing rows may still reference Supabase Storage URLs
      // until the cutover deletes those buckets. Safe to remove once we
      // confirm no avatar_url / vehicle.photos / etc. points there.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Cloudflare R2 — primary asset host going forward
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      // Custom R2 domain — wire this once cdn.drivelink.lk is set up
      {
        protocol: "https",
        hostname: "cdn.drivelink.lk",
      },
      // Unsplash — used by seeded sample listings (safe to remove once
      // every listing has real owner-uploaded photos).
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
