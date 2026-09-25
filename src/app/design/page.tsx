import { guardDesignPreview } from "@/app/design/guard";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Car, CheckCircle2, PackageX, AlertTriangle, Smartphone,
} from "lucide-react";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { pageShellClass } from "@/components/ui/PageShell";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonText, SkeletonVehicleCard } from "@/components/ui/Skeleton";
import { Timeline, TimelineStep } from "@/components/ui/Timeline";
import { ActionBar } from "@/components/ui/ActionBar";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { DEMO_VEHICLES } from "@/lib/demo/fixtures";
import { FormControlsDemo } from "./_components/FormControlsDemo";
import { DialogsDemo } from "./_components/DialogsDemo";
import { MotionDemo } from "./_components/MotionDemo";

export const metadata: Metadata = { title: "Design system" };

// The living style guide: every token and component the revamp introduced,
// rendered for real rather than described. Nothing on this page is linked
// from the product; it exists for the founder and whoever builds the next
// screen, so a token or a component only has to be decided once.

const PREVIEW_LINKS = [
  { href: "/", label: "Homepage", description: "Marketplace landing page." },
  { href: "/vehicles", label: "Browse vehicles", description: "Search, filters and results grid." },
  { href: "/vehicles/demo-toyota-corolla-2019-colombo", label: "Vehicle detail (demo)", description: "A sample listing page, full gallery and booking panel." },
  { href: "/pages/serendib-drive", label: "Rental Page (demo)", description: "A provider's public storefront." },
  { href: "/login", label: "Log in", description: "Sign-in screen." },
  { href: "/design/dashboard", label: "Rental Page dashboard", description: "Owner workspace, signed-in preview." },
  { href: "/design/dashboard/vehicles", label: "Fleet", description: "A Rental Page's vehicle list, signed-in preview." },
  { href: "/design/account", label: "Account", description: "Renter account hub, signed-in preview." },
  { href: "/design/bookings", label: "Bookings", description: "Renter bookings list, signed-in preview." },
  { href: "/design/admin", label: "Admin", description: "The admin workspace shell and home, signed-in preview." },
];

const SLATE = [
  { name: "slate-50", hex: "#f6f8fb", className: "bg-slate-50" },
  { name: "slate-100", hex: "#eef1f6", className: "bg-slate-100" },
  { name: "slate-200", hex: "#e2e7ef", className: "bg-slate-200" },
  { name: "slate-300", hex: "#ccd3df", className: "bg-slate-300" },
  { name: "slate-400", hex: "#98a3b7", className: "bg-slate-400" },
  { name: "slate-500", hex: "#66728a", className: "bg-slate-500" },
  { name: "slate-600", hex: "#4a556c", className: "bg-slate-600" },
  { name: "slate-700", hex: "#353f57", className: "bg-slate-700" },
  { name: "slate-800", hex: "#1f2942", className: "bg-slate-800" },
  { name: "slate-900", hex: "#111a31", className: "bg-slate-900" },
  { name: "slate-950", hex: "#080f24", className: "bg-slate-950" },
];

const BLUE = [
  { name: "blue-50", hex: "#eef5ff", className: "bg-blue-50" },
  { name: "blue-100", hex: "#d9e9ff", className: "bg-blue-100" },
  { name: "blue-200", hex: "#bcd9ff", className: "bg-blue-200" },
  { name: "blue-300", hex: "#8ec0ff", className: "bg-blue-300" },
  { name: "blue-400", hex: "#589dff", className: "bg-blue-400" },
  { name: "blue-500", hex: "#2b7efe", className: "bg-blue-500" },
  { name: "blue-600", hex: "#006bfe", className: "bg-blue-600" },
  { name: "blue-700", hex: "#0056d6", className: "bg-blue-700" },
  { name: "blue-800", hex: "#0746ab", className: "bg-blue-800" },
  { name: "blue-900", hex: "#0b3a85", className: "bg-blue-900" },
  { name: "blue-950", hex: "#001a5a", className: "bg-blue-950" },
];

const NAVY = [
  { name: "navy (logo)", hex: "#001a5a", className: "bg-navy" },
  { name: "navy-deep", hex: "#000c2e", className: "bg-navy-deep" },
];

const STATUS = [
  { name: "emerald", className: "bg-emerald-500", meaning: "Done or positive." },
  { name: "amber", className: "bg-amber-500", meaning: "Needs attention." },
  { name: "rose", className: "bg-rose-500", meaning: "Real risk or blocked." },
];

const TYPE_SCALE = [
  { role: "Hero (marketing)", classes: "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight", sample: "Rent with confidence" },
  { role: "Page title", classes: "text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950", sample: "Vehicle listings" },
  { role: "Section title", classes: "text-lg sm:text-xl font-semibold tracking-tight text-slate-900", sample: "Recent bookings" },
  { role: "Card title", classes: "text-base font-semibold text-slate-900", sample: "2019 Toyota Corolla Hybrid" },
  { role: "Body", classes: "text-sm sm:text-base text-slate-600", sample: "Choose self-drive or with-driver, with airport handover where listed." },
  { role: "Meta", classes: "text-xs text-slate-500", sample: "13px is the floor, never smaller." },
  { role: "Eyebrow", classes: "text-xs font-semibold uppercase tracking-[0.08em] text-blue-700", sample: "Featured listing" },
  { role: "Price", classes: "text-lg sm:text-2xl font-semibold tabular text-slate-950", sample: "Rs. 8,500 / day" },
];

const RADII = [
  { name: "rounded-lg", px: "12px", label: "Inputs, buttons" },
  { name: "rounded-xl", px: "16px", label: "Small tiles" },
  { name: "rounded-2xl", px: "20px", label: "Cards, photos" },
  { name: "rounded-3xl", px: "28px", label: "Sheets, hero panels" },
  { name: "rounded-full", px: "full", label: "Pills" },
];

const SHADOWS = [
  { name: "shadow-xs", label: "Resting card" },
  { name: "shadow-md", label: "Hover, raised" },
  { name: "shadow-lg", label: "Floating: menus, sticky bars" },
  { name: "shadow-xl", label: "Floating: booking panel" },
  { name: "shadow-2xl", label: "Dialogs" },
];

const BUTTON_VARIANTS = ["primary", "secondary", "soft", "dark", "ghost", "danger"] as const;
const BUTTON_SIZES = ["sm", "md", "lg", "xl"] as const;

const BADGE_VARIANTS = [
  { variant: "green" as const, label: "Available" },
  { variant: "amber" as const, label: "Pending review" },
  { variant: "red" as const, label: "Declined" },
  { variant: "blue" as const, label: "Payment pending" },
  { variant: "slate" as const, label: "Draft" },
];

const SECTIONS = [
  { id: "previews", label: "Previews" },
  { id: "colors", label: "Colour" },
  { id: "typography", label: "Typography" },
  { id: "radius-elevation", label: "Radius and elevation" },
  { id: "buttons", label: "Buttons" },
  { id: "badges-chips", label: "Badges and chips" },
  { id: "forms", label: "Forms" },
  { id: "cards", label: "Cards" },
  { id: "feedback", label: "Stat and empty state" },
  { id: "loading", label: "Loading" },
  { id: "timeline", label: "Timeline" },
  { id: "action-bar", label: "Action bar" },
  { id: "dialogs", label: "Dialogs" },
  { id: "vehicles", label: "Vehicle cards" },
  { id: "motion", label: "Motion" },
];

export default function DesignSystemPage() {
  guardDesignPreview();
  const sampleVehicles = DEMO_VEHICLES.slice(0, 3);

  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn={false} />

      <div className={pageShellClass("wide")}>
        <header className="animate-fade-up max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Internal, not linked from the product</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">DriveLink 2.0 design system</h1>
          <p className="text-base text-slate-600 sm:text-lg">
            Every token and component the revamp introduced, rendered live rather than described. This page and the
            rest of /design 404 in production; nothing here is reachable from the real product.
          </p>
        </header>

        <div className="mt-12 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
          <SectionNav />

          <div className="min-w-0 space-y-20">
            <Section id="previews" title="Previews" description="Every screenshot-able screen in the revamp, real or signed-in preview.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PREVIEW_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="block">
                    <Card interactive className="h-full">
                      <p className="font-semibold text-slate-900">{l.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{l.description}</p>
                      <p className="mt-3 text-xs font-medium text-blue-700">{l.href}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </Section>

            <Section id="colors" title="Colour" description="Tailwind's slate and blue scales, redefined from the logo. Read exactly as written in src/app/globals.css.">
              <div className="space-y-10">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Slate, neutral</h3>
                  <SwatchGrid items={SLATE} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Blue, brand</h3>
                  <SwatchGrid items={BLUE} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Logo navy</h3>
                  <SwatchGrid items={NAVY} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Status colours, one meaning each</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {STATUS.map((s) => (
                      <Card key={s.name} padding="sm" className="flex items-center gap-3">
                        <span className={`h-10 w-10 shrink-0 rounded-xl ${s.className}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold capitalize text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.meaning}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section id="typography" title="Typography" description="Poppins only, enforced. Every step sits above the Tailwind default so it holds up on a phone outdoors.">
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06]">
                {TYPE_SCALE.map((t) => (
                  <div key={t.role} className="grid gap-2 p-5 sm:grid-cols-[160px_1fr]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.role}</p>
                      <code className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t.classes}</code>
                    </div>
                    <p className={t.classes}>{t.sample}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="radius-elevation" title="Radius and elevation" description="A deliberate ladder for corners, and soft, layered shadows instead of one flat drop shadow.">
              <div className="space-y-10">
                <div className="flex flex-wrap gap-6">
                  {RADII.map((r) => (
                    <div key={r.name} className="space-y-2 text-center">
                      <div className={`h-20 w-20 bg-blue-100 ring-1 ring-inset ring-blue-200 ${r.name}`} />
                      <p className="text-xs font-semibold text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.label} · {r.px}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-8 rounded-2xl bg-canvas p-8 ring-1 ring-slate-900/[0.04]">
                  {SHADOWS.map((s) => (
                    <div key={s.name} className="space-y-2 text-center">
                      <div className={`h-20 w-28 rounded-2xl bg-white ${s.name}`} />
                      <p className="text-xs font-semibold text-slate-700">{s.name}</p>
                      <p className="max-w-28 text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section id="buttons" title="Buttons" description="One recipe for the whole product. variant + size, never a hand-rolled one-off.">
              <div className="space-y-6">
                {BUTTON_VARIANTS.map((variant) => (
                  <div key={variant} className="flex flex-wrap items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{variant}</span>
                    {BUTTON_SIZES.map((size) => (
                      <Button key={size} variant={variant} size={size}>
                        {variant === "danger" ? "Reject" : "Continue"}
                      </Button>
                    ))}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                  <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">States</span>
                  <Button loading>Saving</Button>
                  <Button disabled>Unavailable</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                  <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">As a link</span>
                  <Link href="/vehicles" className={buttonClasses({ variant: "primary", size: "lg" })}>Browse vehicles</Link>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">buttonClasses(&#123; variant, size &#125;)</code>
                </div>
              </div>
            </Section>

            <Section id="badges-chips" title="Badges and chips" description="Small status signals and filter pills. A badge always leads with a dot; an active chip flips to solid ink.">
              <div className="space-y-8">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Badge</h3>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_VARIANTS.map((b) => <Badge key={b.variant} variant={b.variant}>{b.label}</Badge>)}
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">VerificationBadge</h3>
                  <div className="flex flex-wrap gap-2">
                    <VerificationBadge label="Verified Owner" />
                    <VerificationBadge label="Tourist Friendly" />
                    <VerificationBadge label="Fast Response" />
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Chip, active / inactive / with count</h3>
                  <div className="flex flex-wrap gap-2">
                    <Chip active>All vehicles</Chip>
                    <Chip>Cars</Chip>
                    <Chip>SUVs</Chip>
                    <Chip count={4}>Filters</Chip>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="forms" title="Forms" description="48px controls, 16px+ text so iOS never zooms on focus, and a hint that swaps for an error rather than stacking above it.">
              <FormControlsDemo />
            </Section>

            <Section id="cards" title="Cards" description="One surface recipe: default, raised, tinted, plain.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card variant="default">
                  <p className="text-sm font-semibold text-slate-900">Default</p>
                  <p className="mt-1 text-xs text-slate-500">Hairline and the faintest shadow. The everyday card.</p>
                </Card>
                <Card variant="raised">
                  <p className="text-sm font-semibold text-slate-900">Raised</p>
                  <p className="mt-1 text-xs text-slate-500">No hairline, a real shadow. The one card a screen is about.</p>
                </Card>
                <Card variant="tinted">
                  <p className="text-sm font-semibold text-slate-900">Tinted</p>
                  <p className="mt-1 text-xs text-slate-500">Brand-tinted, for a call-out the reader should notice once.</p>
                </Card>
                <Card variant="plain">
                  <p className="text-sm font-semibold text-slate-900">Plain</p>
                  <p className="mt-1 text-xs text-slate-500">White, no edge, for a card sitting inside another surface.</p>
                </Card>
              </div>
            </Section>

            <Section id="feedback" title="Stat and empty state" description="A number with its meaning attached, and the one way the product says something is missing.">
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Live vehicles" value={128} icon={<Car size={15} aria-hidden="true" />} />
                  <Stat label="Approved" value="98%" tone="positive" icon={<CheckCircle2 size={15} aria-hidden="true" />} />
                  <Stat label="Awaiting review" value={6} tone="attention" icon={<AlertTriangle size={15} aria-hidden="true" />} />
                  <Stat label="Disputes" value={1} tone="risk" hint="Needs a decision today" />
                </div>
                <Card padding="lg">
                  <EmptyState
                    icon={<PackageX size={22} aria-hidden="true" />}
                    title="No vehicles yet"
                    description="Vehicles you add will appear here once DriveLink approves them."
                    action={<Link href="/vehicles" className={buttonClasses({ variant: "primary" })}>Browse vehicles</Link>}
                  />
                </Card>
              </div>
            </Section>

            <Section id="loading" title="Loading" description="Placeholders shaped like the content that is about to arrive, with a slow shimmer.">
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <SkeletonText lines={3} />
                </div>
                <div className="max-w-xs">
                  <SkeletonVehicleCard />
                </div>
              </div>
            </Section>

            <Section id="timeline" title="Timeline" description="The four step states: done, current, upcoming, blocked, shown together for reference.">
              <Card padding="lg" className="max-w-xl">
                <Timeline>
                  <TimelineStep state="done" title="Requested" meta="12 Sep" description="You asked to rent this vehicle." />
                  <TimelineStep state="current" title="Host reviewing" description="Usually replies within an hour." />
                  <TimelineStep
                    state="blocked"
                    title="Payment"
                    description="The card was declined."
                    action={<Button size="sm" variant="secondary">Retry payment</Button>}
                  />
                  <TimelineStep state="upcoming" title="Pickup" description="Collect the vehicle from the host." last />
                </Timeline>
              </Card>
            </Section>

            <Section id="action-bar" title="Action bar" description="Sticky primary action for a phone, floating above the tab bar. Hidden at the md breakpoint and up, since the desktop layout already keeps the action on screen.">
              <Card padding="lg" className="relative flex items-center gap-3 overflow-hidden">
                <Smartphone size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                <p className="text-sm text-slate-600">
                  Resize below 768px, or view <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">/design</code> on a
                  phone, to see it floating above the tab bar.
                </p>
              </Card>
              <ActionBar summary={<span>Rs. 8,500<span className="text-slate-400"> / day</span></span>}>
                <Button variant="primary" block>Request this vehicle</Button>
              </ActionBar>
            </Section>

            <Section id="dialogs" title="Dialogs" description="ConfirmDialog replaces window.confirm() for anything that cannot be undone. BottomSheet is the shared sheet-on-phone, dialog-on-desktop surface.">
              <DialogsDemo />
            </Section>

            <Section id="vehicles" title="Vehicle cards" description="Real VehicleCard, real sample listings from the demo fixtures used across /vehicles in preview mode.">
              <Suspense fallback={<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{sampleVehicles.map((v) => <SkeletonVehicleCard key={v.id} />)}</div>}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {sampleVehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
                </div>
              </Suspense>
            </Section>

            <Section id="motion" title="Motion" description="Subtle, out-expo entrances. Never on every render of a list item, only when something genuinely arrives.">
              <MotionDemo />
            </Section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function SectionNav() {
  return (
    <nav aria-label="On this page" className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-0.5 overflow-y-auto pr-4 pb-8 text-sm">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="block rounded-lg px-3 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function SwatchGrid({ items }: { items: { name: string; hex: string; className: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((c) => (
        <div key={c.name} className="space-y-1.5">
          <div className={`h-14 w-full rounded-xl ring-1 ring-slate-900/[0.06] ${c.className}`} aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-700">{c.name}</p>
          <p className="tabular text-xs text-slate-500">{c.hex}</p>
        </div>
      ))}
    </div>
  );
}
