import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ShieldCheck, Star, MapPin, Clock } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/server";
import { formatLKR } from "@/lib/vehicles/format";
import { providerNounCap } from "@/lib/providers/label";
import { pageShellClass } from "@/components/ui/PageShell";

interface Props { params: Promise<{ slug: string }> }

// Public columns only - this is a service-client read of a signed-out
// storefront, so it must never select contact/registration/internal fields.
const PAGE_SELECT =
  "id, name, slug, city, description, logo_url, cover_url, business_hours, " +
  "provider_type, page_type, is_verified, rating_avg, rating_count, reliability_pct, " +
  "avg_response_minutes, created_at";

interface PageProfile {
  id: string; name: string; slug: string; city: string; description: string | null;
  logo_url: string | null; cover_url: string | null; business_hours: string | null;
  provider_type: string | null; page_type: string; is_verified: boolean;
  rating_avg: number | null; rating_count: number | null; reliability_pct: number | null;
  avg_response_minutes: number | null; created_at: string;
}

async function loadPage(slug: string): Promise<PageProfile | null> {
  const publicClient = createPublicClient();
  const { data } = await publicClient
    .from("agencies")
    .select(PAGE_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  return (data as unknown as PageProfile) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  // Resolve the trust gate before the streamed page starts so a hidden page
  // returns a real HTTP 404, rather than a 200 response containing a late
  // not-found boundary.
  if (!page) notFound();
  return {
    title: `${page.name as string} | DriveLink`,
    description: (page.description as string) || `Rent vehicles from ${page.name} on DriveLink.`,
  };
}

export default async function RentalPageProfile({ params }: Props) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  const service = createPublicClient();
  const agencyId = page.id as string;

  const [{ data: vehiclesData }, { data: reviewsData }] = await Promise.all([
    service.from("vehicles")
      .select("id, slug, make, model, year, city, daily_rate_lkr, photos, vehicle_type")
      .eq("agency_id", agencyId).eq("status", "available")
      .order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(24),
    service.from("reviews")
      .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)")
      .eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(10),
  ]);
  const vehicles = (vehiclesData ?? []) as { id: string; slug: string; make: string; model: string; year: number; city: string; daily_rate_lkr: number; photos: string[] | null; vehicle_type: string }[];
  const reviews = (reviewsData ?? []) as unknown as { id: string; rating: number; comment: string | null; created_at: string; reviewer: { full_name: string } | null }[];

  const noun = providerNounCap((page.provider_type as string) ?? null);
  const rating = page.rating_avg ? Number(page.rating_avg) : null;

  return (
    <div>
      {/* Cover */}
      <div className="relative h-40 sm:h-56 bg-slate-200">
        {page.cover_url ? (
          <Image src={page.cover_url as string} alt="" fill sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-slate-200" />
        )}
      </div>

      <div className={pageShellClass("standard")}>
        {/* Header */}
        <div className="flex items-end gap-4 -mt-10 relative">
          <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden shrink-0 flex items-center justify-center">
            {page.logo_url ? (
              <Image src={page.logo_url as string} alt={page.name as string} width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              <span className="text-2xl font-bold text-slate-400">{(page.name as string).slice(0, 1)}</span>
            )}
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{page.name as string}</h1>
              {page.is_verified && (
                <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={12} /> {page.page_type === "business" ? "Verified business" : "Verified"}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm inline-flex items-center gap-1"><MapPin size={12} /> {page.city as string} · {noun}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat label="Rating" value={rating ? `${rating.toFixed(1)} ★` : "New"} />
          <Stat label="Reviews" value={String(page.rating_count ?? 0)} />
          <Stat label="Fleet" value={String(vehicles.length)} />
        </div>

        {page.description && <p className="text-slate-700 text-sm mt-5 whitespace-pre-wrap">{page.description as string}</p>}
        {page.business_hours && (
          <p className="text-slate-500 text-sm mt-2 inline-flex items-center gap-1"><Clock size={13} /> {page.business_hours as string}</p>
        )}

        {/* Fleet */}
        <h2 className="text-lg font-bold text-slate-900 mt-8 mb-3">Available vehicles</h2>
        {vehicles.length === 0 ? (
          <p className="text-slate-500 text-sm">No vehicles available right now.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {vehicles.map((v) => (
              <Link key={v.id} href={`/vehicles/${v.slug}`} className="block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-blue-300 transition-colors">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {v.photos?.[0] && <Image src={v.photos[0]} alt={`${v.make} ${v.model}`} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-slate-900 text-sm truncate">{v.year} {v.make} {v.model}</p>
                  <p className="text-slate-500 text-xs">{v.city}</p>
                  <p className="text-blue-700 text-sm font-semibold mt-1">{formatLKR(v.daily_rate_lkr)}<span className="text-slate-400 font-normal">/day</span></p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-900 mt-8 mb-3">Reviews</h2>
            <div className="space-y-3 pb-10">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-amber-500 text-sm font-semibold"><Star size={13} fill="currentColor" /> {r.rating}</span>
                    <span className="text-slate-700 text-sm font-medium">{r.reviewer?.full_name ?? "Renter"}</span>
                    <span className="text-slate-400 text-xs ml-auto">{new Date(r.created_at).toLocaleDateString("en-LK")}</span>
                  </div>
                  {r.comment && <p className="text-slate-600 text-sm mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 text-center shadow-sm">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-slate-500 text-xs">{label}</p>
    </div>
  );
}
