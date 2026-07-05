import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.appUrl.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private / transactional areas out of the index.
      disallow: ["/admin", "/dashboard", "/account", "/bookings", "/api/", "/auth/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
