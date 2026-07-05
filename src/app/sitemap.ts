import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";
import { LANDINGS } from "@/data/landings";

// Dynamic sitemap, static pages + SEO landing pages + every live vehicle.
// Helps Google index the listing pages (plan §11).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.appUrl.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = ["", "/vehicles", "/pricing", "/faq", "/terms", "/privacy"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.7,
  }));

  const landingRoutes = LANDINGS.map((l) => ({
    url: `${base}/sri-lanka/${l.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  let vehicleRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data: vehicles } = await supabase
      .from("vehicles").select("slug, updated_at").eq("status", "available").limit(1000);
    vehicleRoutes = ((vehicles ?? []) as { slug: string; updated_at: string }[]).map((v) => ({
      url: `${base}/vehicles/${v.slug}`,
      lastModified: v.updated_at ? new Date(v.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Sitemap should still build if the DB is unreachable at build time.
  }

  return [...staticRoutes, ...landingRoutes, ...vehicleRoutes];
}
