import Link from "next/link";
import Image from "next/image";
import { Car, ExternalLink, ShieldAlert, Fuel, Users2, Palette, Hash, Images } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChipLink } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { VehicleApprovalActions } from "@/components/admin/VehicleApprovalActions";
import { VehicleBadgeEditor } from "@/components/admin/VehicleBadgeEditor";
import { VehicleFeatureToggle } from "@/components/admin/VehicleFeatureToggle";
import { VehicleVerificationToggle } from "@/components/admin/VehicleVerificationToggle";
import { formatLKR, insuranceLabel, fuelPolicyLabel } from "@/lib/vehicles/format";
import { hasCurrentVehicleCompliance, listingPublicationProblem } from "@/lib/vehicles/trust";
import type { VehicleStatus } from "@/types/database";

// The moderation queue is the admin's most important screen: nothing a host
// lists reaches a renter until someone reviews it here. So the default tab
// (pending_review) gets the richest card, every fact a reviewer needs without
// opening another tab, and everything already decided (live, unlisted, "went
// live on its own") collapses to a compact row that only needs a spot check.

export const FILTER_TABS = [
  { label: "Pending review", value: "pending_review" },
  { label: "Live", value: "available" },
  { label: "Unlisted", value: "unlisted" },
  // Complete listings from a page with an approved listing publish without
  // review. They land here so the team can spot-check them.
  { label: "Went live on its own", value: "auto" },
  { label: "All", value: "all" },
] as const;

export interface ModerationVehicleDoc {
  cr_url: string | null;
  insurance_url: string | null;
  revenue_license_url: string | null;
}

export interface ModerationVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  city: string;
  slug: string;
  photos: string[] | null;
  daily_rate_lkr: number;
  monthly_rate_lkr: number | null;
  deposit_lkr: number;
  status: VehicleStatus;
  insurance_type: "private" | "hire";
  insurance_expiry: string | null;
  revenue_license_expiry: string | null;
  fuel_policy: "full_to_full" | "same_to_same";
  transmission: string;
  seats: number;
  color: string | null;
  plate_number: string | null;
  self_drive: boolean;
  with_driver: boolean;
  airport_pickup: boolean;
  features: string[] | null;
  description: string | null;
  badges: string[];
  is_featured: boolean;
  verified_vehicle: boolean;
  auto_published_at: string | null;
  created_at: string;
  listing_authority_declared: boolean;
  listing_authority_basis: string | null;
  listing_authority_confirmed_at: string | null;
  listing_authority_confirmed_by: string | null;
  listing_authority_declaration_version: string | null;
  rejection_reason?: string | null;
  agencies: { name: string; city: string; whatsapp_number: string } | null;
}

export interface VehicleModerationViewProps {
  vehicles: ModerationVehicle[];
  activeFilter: string;
  docsByVehicleId: Record<string, ModerationVehicleDoc | undefined>;
}

function submittedLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

function rentalModes(v: ModerationVehicle): string[] {
  const modes: string[] = [];
  if (v.self_drive) modes.push("Self-drive");
  if (v.with_driver) modes.push("With driver");
  if (v.airport_pickup) modes.push("Airport pickup");
  return modes;
}

export function VehicleModerationView({ vehicles, activeFilter, docsByVehicleId }: VehicleModerationViewProps) {
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Vehicle listings"
        description={
          "Approve new listings before they go live. Once a page has an approved listing, its complete listings go " +
          'live on their own; spot-check those under "Went live on its own". Rejecting a listing turns that off for the page.'
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(({ label, value }) => (
          <ChipLink key={value} href={`/admin/vehicles?status=${value}`} active={activeFilter === value}>
            {label}
          </ChipLink>
        ))}
      </div>

      {vehicles.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            bare
            icon={<Car size={22} className="text-slate-400" strokeWidth={1.5} />}
            title="Nothing here"
            description={
              activeFilter === "pending_review"
                ? "No vehicles waiting for review."
                : activeFilter === "auto"
                  ? "Nothing has gone live on its own yet."
                  : "No vehicles match this filter."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) =>
            v.status === "pending_review" ? (
              <FullReviewCard key={v.id} v={v} doc={docsByVehicleId[v.id]} />
            ) : (
              <CompactCard key={v.id} v={v} doc={docsByVehicleId[v.id]} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ photos, alt }: { photos: string[]; alt: string }) {
  if (photos.length === 0) {
    return (
      <div className="flex h-24 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm text-slate-500">
        <Car size={18} strokeWidth={1.5} aria-hidden="true" /> No photos uploaded yet.
      </div>
    );
  }
  const shown = photos.slice(0, 4);
  return (
    <div className="mask-fade-x -mx-1 flex snap-x gap-2 overflow-x-auto scrollbar-none px-1 pb-1">
      {shown.map((url, i) => (
        <a
          key={url + i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative h-28 w-40 shrink-0 snap-start overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-900/[0.06] transition-shadow hover:ring-blue-300"
        >
          <Image src={url} alt={`${alt}, photo ${i + 1}`} fill className="object-cover" sizes="160px" />
          {i === 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
              Cover
            </span>
          )}
          {i === 3 && photos.length > 4 && (
            <span className="absolute inset-0 grid place-items-center bg-slate-950/55 text-sm font-semibold text-white">
              +{photos.length - 4} more
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              View <ExternalLink size={10} aria-hidden="true" />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

function RentalModeBadges({ v }: { v: ModerationVehicle }) {
  const modes = rentalModes(v);
  if (modes.length === 0) return <Badge variant="red">No rental mode chosen</Badge>;
  return (
    <>
      {modes.map((m) => (
        <Badge key={m} variant="slate">{m}</Badge>
      ))}
    </>
  );
}

function DocProof({ doc }: { doc: ModerationVehicleDoc | undefined }) {
  if (!doc || (!doc.cr_url && !doc.insurance_url)) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-amber-700">
        <ShieldAlert size={13} className="shrink-0" aria-hidden="true" />
        No documents uploaded yet. Request CR + insurance before awarding &quot;Documents Checked&quot;.
      </p>
    );
  }
  const links: { label: string; url: string }[] = [
    doc.cr_url && { label: "Registration (CR)", url: doc.cr_url },
    doc.insurance_url && { label: "Insurance", url: doc.insurance_url },
    doc.revenue_license_url && { label: "Revenue licence", url: doc.revenue_license_url },
  ].filter(Boolean) as { label: string; url: string }[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15 transition-colors hover:bg-blue-100"
        >
          {l.label} <ExternalLink size={11} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function RightToList({ v }: { v: ModerationVehicle }) {
  if (v.listing_authority_declared && v.listing_authority_confirmed_at) {
    return (
      <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-900/[0.05]">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Right to list</p>
        <p className="mt-1 text-sm font-medium text-slate-900">
          {v.listing_authority_basis === "registered_owner"
            ? "Page operator says it owns the vehicle"
            : "Page operator says the registered owner authorised it"}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Self-declared on {submittedLabel(v.listing_authority_confirmed_at)}. Compare the plate and any submitted
          CR; ask for written authority when the operator is not the registered owner.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Right to list</p>
      <p className="mt-1 text-sm font-semibold text-amber-800">No recorded right-to-list declaration. Do not publish.</p>
    </div>
  );
}

function RejectedNotice({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl bg-rose-50 px-3.5 py-3 ring-1 ring-rose-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Rejected</p>
      <p className="mt-1 text-sm leading-5 text-rose-900">{reason}</p>
    </div>
  );
}

function FullReviewCard({ v, doc }: { v: ModerationVehicle; doc: ModerationVehicleDoc | undefined }) {
  const title = `${v.year} ${v.make} ${v.model}`;
  const approvalProblem = listingPublicationProblem(v, { approvalClearsRejection: true });
  const eligible = hasCurrentVehicleCompliance(v) && Boolean(doc?.cr_url && doc?.insurance_url && doc?.revenue_license_url);

  return (
    <Card padding="lg" className="ring-2 ring-amber-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="amber">Needs a decision</Badge>
            <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>{insuranceLabel(v.insurance_type)}</Badge>
          </div>
          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {v.agencies?.name ?? "-"} <span className="text-slate-400">&middot;</span> {v.city}
            {v.agencies?.whatsapp_number ? <> <span className="text-slate-400">&middot;</span> {v.agencies.whatsapp_number}</> : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Submitted {submittedLabel(v.created_at)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-xl font-semibold text-slate-950">{formatLKR(v.daily_rate_lkr)}<span className="text-sm font-normal text-slate-500"> / day</span></p>
          {v.monthly_rate_lkr && <p className="tabular text-xs text-emerald-700">{formatLKR(v.monthly_rate_lkr)} / month</p>}
          {v.deposit_lkr > 0 && <p className="tabular text-xs text-slate-500">+ {formatLKR(v.deposit_lkr)} deposit</p>}
        </div>
      </div>

      <div className="mt-4">
        <PhotoStrip photos={v.photos ?? []} alt={title} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <RentalModeBadges v={v} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Spec icon={<Users2 size={13} aria-hidden="true" />} label="Seats" value={`${v.seats} · ${v.transmission}`} />
        <Spec icon={<Fuel size={13} aria-hidden="true" />} label="Fuel policy" value={fuelPolicyLabel(v.fuel_policy)} />
        <Spec icon={<Palette size={13} aria-hidden="true" />} label="Colour" value={v.color || "-"} />
        <Spec icon={<Hash size={13} aria-hidden="true" />} label="Plate" value={v.plate_number || "-"} mono />
      </div>

      {v.description && (
        <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{v.description}</p>
        </div>
      )}

      {v.features && v.features.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Images size={12} aria-hidden="true" /> Features ({v.features.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {v.features.map((f) => <Badge key={f} variant="slate">{f}</Badge>)}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RightToList v={v} />
        <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-900/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Document proof</p>
          <div className="mt-1.5"><DocProof doc={doc} /></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Verified Vehicle review requires registration, hire insurance, and a revenue licence.</p>
        </div>
      </div>

      {v.rejection_reason && <div className="mt-4"><RejectedNotice reason={v.rejection_reason} /></div>}

      <div className="mt-4">
        <VehicleBadgeEditor vehicleId={v.id} initialBadges={v.badges ?? []} />
      </div>
      <div className="mt-3">
        <VehicleVerificationToggle vehicleId={v.id} initial={v.verified_vehicle} eligible={eligible} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <Link
          href={`/vehicles/${v.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          Open public preview <ExternalLink size={13} aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <VehicleFeatureToggle vehicleId={v.id} initial={v.is_featured ?? false} />
          <VehicleApprovalActions vehicleId={v.id} status={v.status} approvalProblem={approvalProblem} />
        </div>
      </div>
    </Card>
  );
}

function Spec({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="flex items-center gap-1 text-xs text-slate-500">{icon} {label}</p>
      <p className={`mt-0.5 text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function CompactCard({ v, doc }: { v: ModerationVehicle; doc: ModerationVehicleDoc | undefined }) {
  const title = `${v.year} ${v.make} ${v.model}`;
  const cover = v.photos?.[0];
  const approvalProblem = listingPublicationProblem(v, { approvalClearsRejection: true });
  const eligible = hasCurrentVehicleCompliance(v) && Boolean(doc?.cr_url && doc?.insurance_url && doc?.revenue_license_url);

  return (
    <Card padding="md">
      <div className="flex gap-3">
        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-20 sm:w-28">
          {cover ? (
            <Image src={cover} alt={title} fill className="object-cover" sizes="112px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Car size={22} strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {v.auto_published_at && <div className="mt-1"><Badge variant="blue">Went live on its own</Badge></div>}
            <p className="mt-0.5 text-xs text-slate-500">{v.agencies?.name ?? "-"} &middot; {v.city}</p>
          </div>
          <p className="shrink-0 tabular text-sm font-semibold text-blue-600 sm:text-right">
            {formatLKR(v.daily_rate_lkr)}<span className="text-xs font-normal text-slate-500"> / day</span>
          </p>
        </div>
      </div>

      {v.rejection_reason && <div className="mt-3"><RejectedNotice reason={v.rejection_reason} /></div>}

      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href={`/vehicles/${v.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Preview <ExternalLink size={11} aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <VehicleFeatureToggle vehicleId={v.id} initial={v.is_featured ?? false} />
          <VehicleApprovalActions vehicleId={v.id} status={v.status} approvalProblem={approvalProblem} />
        </div>
      </div>
      <div className="mt-3">
        <VehicleBadgeEditor vehicleId={v.id} initialBadges={v.badges ?? []} />
      </div>
      <div className="mt-3">
        <VehicleVerificationToggle vehicleId={v.id} initial={v.verified_vehicle} eligible={eligible} />
      </div>
    </Card>
  );
}
