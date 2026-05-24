import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
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
    ],
  },
};

export default nextConfig;
