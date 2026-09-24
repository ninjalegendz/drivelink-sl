import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ShieldCheck, Star, MapPin, Clock, MessageCircleMore, Car } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/server";
import { providerNoun, providerNounCap } from "@/lib/providers/label";
import {
  reliabilityLabel, responseTimeLabel, RELIABILITY_MIN_RENTALS,
} from "@/lib/vehicles/format";
import { PUBLIC_VEHICLE_WITH_AGENCY_SELECT } from "@/lib/vehicles/public-query";
import { pageShellClass } from "@/components/ui/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { isDemoMode, DEMO_AGENCIES, DEMO_VEHICLES } from "@/lib/demo/fixtures";
import type { VehicleWithAgency } from "@/types/queries";

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

interface ReviewRow {
  id: string; rating: number; comment: string | null; created_at: string;
  reviewer: { full_name: string } | null;
}

type DemoAgencyRow = (typeof DEMO_AGENCIES)[number];

// Short, specific one-liners for the four local-preview pages, same voice as
// the demo vehicle descriptions in src/lib/demo/fixtures.ts. Local preview
// only: see the isDemoMode() guard below, inert in a production build.
const DEMO_DESCRIPTIONS: Record<string, string> = {
  "serendib-drive": "Airport pickups, hybrid and SUV options, and a Nugegoda yard for handover any day of the week.",
  "kandy-hill-rentals": "Hill-country 4x4s and family SUVs for Kandy, Nuwara Eliya and the Ella road.",
  "nimals-car-hire": "A small personal fleet kept garaged in Galle, easy parking in the Fort and happy on the coast road.",
  "ella-ride-co": "Bikes and scooters for getting around Ella and the surrounding hill towns.",
};
const DEMO_HOURS: Record<string, string | null> = {
  "serendib-drive": "Every day, 7am to 9pm",
  "kandy-hill-rentals": "Every day, 7am to 8pm",
  "nimals-car-hire": null,
  "ella-ride-co": "Every day, 8am to 6pm",
};

function demoAgencyToProfile(a: DemoAgencyRow): PageProfile {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    city: a.city,
    description: DEMO_DESCRIPTIONS[a.slug] ?? null,
    logo_url: null,
    cover_url: null,
    business_hours: DEMO_HOURS[a.slug] ?? null,
    provider_type: a.provider_type ?? null,
    page_type: a.provider_type === "individual" ? "individual" : "business",
    is_verified: a.is_verified,
    rating_avg: a.rating_avg ?? null,
    rating_count: a.rating_count ?? null,
    reliability_pct: a.reliability_pct ?? null,
    avg_response_minutes: a.avg_response_minutes ?? null,
    created_at: "2026-01-01T00:00:00Z",
  };
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

function resolveDemoPage(slug: string): PageProfile | null {
  if (!isDemoMode()) return null;
  const a = DEMO_AGENCIES.find((row) => row.slug === slug);
  return a ? demoAgencyToProfile(a) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Resolve the trust gate before the streamed page starts so a hidden page
  // returns a real HTTP 404, rather than a 200 response containing a late
  // not-found boundary.
  const page = (await loadPage(slug)) ?? resolveDemoPage(slug);
  if (!page) notFound();
  return {
    title: `${page.name} | DriveLink`,
    description: page.description || `Rent vehicles from ${page.name} on DriveLink.`,
  };
}

export default async function RentalPageProfile({ params }: Props) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const realPage = await loadPage(slug);
  // Local design preview only; see src/lib/demo/fixtures.ts. Never reached in
  // production because isDemoMode() is always false there.
  const demoPage = !realPage ? resolveDemoPage(slug) : null;
  const page = realPage ?? demoPage;
  if (!page) notFound();

  const agencyId = page.id;
  const isDemo = !realPage;

  let vehicles: VehicleWithAgency[];
  let reviews: ReviewRow[];
  let rentalsDone: number;

  if (isDemo) {
    vehicles = DEMO_VEHICLES.filter((v) => v.agency_id === agencyId && v.status === "available");
    reviews = [];
    // No completed-bookings table in the fixtures; the review count left by
    // past renters is the closest stand-in for "has this page done rentals".
    rentalsDone = page.rating_count ?? 0;
  } else {
    const [{ data: vehiclesData }, { data: reviewsData }, { count: completedCount }] = await Promise.all([
      supabase.from("vehicles")
        .select(PUBLIC_VEHICLE_WITH_AGENCY_SELECT)
        .eq("agency_id", agencyId).eq("status", "available")
        .order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(24),
      supabase.from("reviews")
        .select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name)")
        .eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(10),
      supabase.from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId).eq("status", "completed"),
    ]);
    vehicles = (vehiclesData ?? []) as unknown as VehicleWithAgency[];
    reviews = (reviewsData ?? []) as unknown as ReviewRow[];
    rentalsDone = completedCount ?? 0;
  }

  const noun = providerNoun(page.provider_type);
  const nounCap = providerNounCap(page.provider_type);
  const rating = page.rating_avg ? Number(page.rating_avg) : null;
  const replyLabel = responseTimeLabel(page.avg_response_minutes);

  const reliabilityTone =
    rentalsDone < RELIABILITY_MIN_RENTALS || page.reliability_pct === null
      ? "neutral"
      : page.reliability_pct >= 90 ? "positive" : page.reliability_pct >= 75 ? "attention" : "risk";

  return (
    <div>
      {/* Cover: inset rounded panel, same treatment as the marketing Hero. */}
      {/* Without a photo there is nothing to show, so the banner is shorter
          and only carries the brand wash. */}
      <div className={`relative mx-3 mt-3 overflow-hidden rounded-3xl sm:mx-4 sm:mt-4 lg:mx-6 lg:mt-6 ${
        page.cover_url ? "h-40 sm:h-56 lg:h-64" : "h-32 sm:h-40 lg:h-44"
      }`}>
        {page.cover_url ? (
          <Image src={page.cover_url} alt="" fill sizes="100vw" className="object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-brand-gradient" />
        )}
      </div>

      <div className={pageShellClass("wide", "space-y-10")}>
        {/* Header: logo overlaps the cover's bottom edge. */}
        {/* relative z-10: the cover is positioned, so without its own stacking
            the header would paint underneath it and the logo would look cut. */}
        <div className="relative z-10 -mt-14 flex flex-wrap items-end gap-4 sm:-mt-16">
          <div className="h-24 w-24 shrink-0 rounded-2xl bg-white p-1 shadow-lg ring-1 ring-slate-900/[0.06] sm:h-28 sm:w-28">
            <div className={`grid h-full w-full place-items-center overflow-hidden rounded-xl ${page.logo_url ? "bg-slate-100" : "bg-gradient-to-br from-blue-500 to-blue-800"}`}>
              {page.logo_url ? (
                <Image src={page.logo_url} alt={page.name} width={112} height={112} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-semibold text-white">{page.name.slice(0, 1)}</span>
              )}
            </div>
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{page.name}</h1>
              {page.is_verified && (
                <Badge variant="green" dot={false}>
                  <ShieldCheck size={12} aria-hidden="true" /> {page.page_type === "business" ? "Verified business" : "Verified"}
                </Badge>
              )}
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={13} aria-hidden="true" /> {page.city} · {nounCap}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Rating" icon={<Star size={14} className="fill-current text-amber-400" />} value={rating ? rating.toFixed(1) : "New"} />
          <Stat label="Reviews" value={page.rating_count ?? 0} />
          <Stat
            label="Reliability"
            tone={reliabilityTone}
            value={reliabilityLabel(page.reliability_pct, rentalsDone)}
            hint={rentalsDone < RELIABILITY_MIN_RENTALS ? "New page, still building a track record" : "From completed rentals"}
          />
          <Stat label="Replies" icon={<MessageCircleMore size={14} />} value={replyLabel ?? "New"} hint={replyLabel ? "typical response time" : undefined} />
        </div>

        {(page.description || page.business_hours) && (
          <div className="max-w-3xl space-y-3">
            {page.description && <p className="whitespace-pre-wrap text-base leading-7 text-slate-700">{page.description}</p>}
            {page.business_hours && (
              <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <Clock size={14} aria-hidden="true" /> {page.business_hours}
              </p>
            )}
          </div>
        )}

        {/* Fleet */}
        <Section
          title="Available vehicles"
          description={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} listed by this ${noun}`}
        >
          {vehicles.length === 0 ? (
            <EmptyState
              icon={<Car size={22} aria-hidden="true" />}
              title="No vehicles available to book"
              description="Browse other listings across Sri Lanka."
              action={
                <Link href="/vehicles" className={buttonClasses({ variant: "secondary" })}>
                  Browse all vehicles
                </Link>
              }
            />
          ) : (
            <VehiclesBrowser vehicles={vehicles} gridClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" />
          )}
        </Section>

        {/* Reviews */}
        {reviews.length > 0 && (
          <Section title="Reviews" className="pb-10">
            <div className="grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <Card key={r.id} padding="md">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-500">
                      <Star size={13} className="fill-current" aria-hidden="true" /> {r.rating}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{r.reviewer?.full_name ?? "Renter"}</span>
                    <span className="ml-auto text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("en-LK")}</span>
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-slate-600">{r.comment}</p>}
                </Card>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
