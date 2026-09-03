import Link from "next/link";
import { ShieldCheck, Search, MessageSquare, Car, Truck, Bike, Plane } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { HeroSearchForm } from "@/components/vehicles/HeroSearchForm";
import { getHomeFeaturedCached } from "@/lib/vehicles/search";
import { LANDINGS } from "@/data/landings";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageShellClass } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Vehicle Rentals in Sri Lanka",
  description:
    "Find cars, vans, SUVs, bikes and tuk-tuks across Sri Lanka. DriveLink's booking confirmation fee is Rs. 0.",
};

const VERTICALS = [
  { href: "/vehicles?type=car",                 label: "Self-Drive Cars", Icon: Car },
  { href: "/vehicles?option=with-driver",       label: "With Driver",     Icon: Truck },
  { href: "/vehicles?option=airport-pickup",    label: "Airport Handover", Icon: Plane },
  { href: "/vehicles?type=bike",                label: "Bikes & Scooters", Icon: Bike },
];

export default async function HomePage() {
  const [featured, supabase] = await Promise.all([getHomeFeaturedCached(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      {/* Full-bleed: the hero sits outside the page column so the photograph
          runs the whole width of the screen. */}
      <Hero
        badge="Sri Lanka vehicle rentals, with clearer records"
        title={<>Rent a vehicle with the details in one place.<br /><span className="text-blue-200">Send a request for free.</span></>}
        subtitle="Compare cars, vans, bikes and airport options. Each listing shows the provider, rental mode, terms and the checks recorded for that vehicle."
      >
        <div className="space-y-4">
          <HeroSearchForm />
          <div className="flex flex-wrap gap-3">
            <Link
              href={user ? "/account/pages/new" : "/signup?intent=provider"}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/50 bg-white px-5 py-2.5 font-semibold text-slate-950 hover:bg-slate-100"
            >
              List your vehicle for free
            </Link>
          </div>
        </div>
      </Hero>

      <div className={pageShellClass("wide", "space-y-12")}>

      {/* Verticals strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {VERTICALS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 items-center gap-3 border border-slate-200 bg-white p-4 hover:border-blue-300"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Icon size={18} />
            </span>
            <span className="font-semibold text-slate-800 text-sm">{label}</span>
          </Link>
        ))}
      </div>

      {/* Featured vehicles */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Featured vehicles</h2>
            <p className="text-sm text-slate-600">Compare provider, rental mode, price and the checks recorded on each listing.</p>
          </div>
          <Link href="/vehicles" className="text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors">
            View all →
          </Link>
        </div>

        {featured.length > 0 ? (
          <VehiclesBrowser vehicles={featured} />
        ) : (
          <div className="text-center py-16 text-slate-400 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
            <p>No vehicles listed yet. Check back soon.</p>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800">How DriveLink works</h2>
        <ol className="grid sm:grid-cols-3 gap-4">
          {[
            { n: 1, Icon: Search, title: "Compare listing details", text: "Filter by type, location and travel style. Open a listing to see its provider, terms and recorded checks." },
            { n: 2, Icon: ShieldCheck, title: "Send a booking request", text: "Tell the owner your dates. DriveLink's booking confirmation fee is Rs. 0, and DriveLink never holds your deposit." },
            { n: 3, Icon: MessageSquare, title: "Connect & pick up", text: "Once approved, the owner's contact unlocks so you can sync the handover. You pay the host directly." },
          ].map((s) => (
            <li key={s.n} className="border border-slate-200 bg-white p-5">
              <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <s.Icon size={18} />
              </span>
              <h3 className="font-semibold text-slate-800 mb-1">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Popular searches, internal links to SEO landing pages */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Popular searches</h2>
        <div className="flex flex-wrap gap-2">
          {LANDINGS.map((l) => (
            <Link
              key={l.slug}
              href={`/sri-lanka/${l.slug}`}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              {l.h1}
            </Link>
          ))}
        </div>
      </section>
    </div>
    </>
  );
}
