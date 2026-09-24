import Link from "next/link";
import Image from "next/image";
import { Car, Plus, ExternalLink, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site-config";
import { Badge } from "@/components/ui/Badge";
import { VehicleStatusToggle } from "@/components/dashboard/VehicleStatusToggle";
import { ResubmitButton } from "@/components/dashboard/ResubmitButton";
import { DismissNotice } from "@/components/dashboard/DismissNotice";
import { Card } from "@/components/ui/Card";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

const STATUS_VARIANT = {
  available:      "green",
  rented:         "yellow",
  maintenance:    "slate",
  unlisted:       "red",
  pending_review: "blue",
} as const;

const STATUS_LABEL = {
  available:      "Listed",
  rented:         "Rented",
  maintenance:    "Maintenance",
  unlisted:       "Unlisted",
  pending_review: "Pending review",
} as const;

export interface FleetViewProps {
  vehicles: VehicleRow[];
  agencyName: string;
  agencyId: string;
  canDeclareListingAuthority: boolean;
  /** One-off notices raised by the fleet page's own query params. */
  failedPhotoCount?: number;
  documentsRetry?: boolean;
  authorityOwnerReview?: boolean;
  submitted?: "live" | "review" | null;
}

/**
 * The fleet list: one card per vehicle, status pill top right, and the
 * actions an owner actually needs (edit, availability, duplicate, preview)
 * plus the one thing DriveLink needs from them next (the right-to-list
 * declaration, a rejection to fix). Presentation only: every query and
 * capability check lives in (dashboard)/dashboard/vehicles/page.tsx.
 */
export function FleetView({
  vehicles, agencyName, agencyId, canDeclareListingAuthority,
  failedPhotoCount = 0, documentsRetry = false, authorityOwnerReview = false, submitted = null,
}: FleetViewProps) {
  return (
    <div>
      <div className="mb-8">
        <PageHeader
          title="Fleet"
          description={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} on this Rental Page.`}
          actions={
            <Link href="/dashboard/vehicles/new" className={buttonClasses({ variant: "primary", size: "md" })}>
              <Plus size={16} aria-hidden="true" /> Add vehicle
            </Link>
          }
        />
      </div>

      {failedPhotoCount > 0 && (
        <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The listing was saved, but {failedPhotoCount} photo{failedPhotoCount === 1 ? " did" : "s did"} not upload. Open the listing and add {failedPhotoCount === 1 ? "it" : "them"} again.
          <DismissNotice />
        </div>
      )}

      {documentsRetry && (
        <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your listing was submitted, but its private document upload did not finish. Open the listing and upload the documents again.
          <DismissNotice />
        </div>
      )}

      {authorityOwnerReview && (
        <div role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Vehicle details were saved privately. A Rental Page owner or manager must open the listing, confirm the page&apos;s right to list it, and submit it for DriveLink review.
          <DismissNotice />
        </div>
      )}

      {submitted === "live" && (
        <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          Your vehicle is live. Renters can find it and send requests now.
          <DismissNotice />
        </div>
      )}

      {submitted === "review" && (
        <div role="status" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
          Sent for review. New listings are usually checked within 24 hours, and we text you the moment it goes live.
          Once one listing is approved, your next ones go live as soon as you submit them.
          <DismissNotice />
        </div>
      )}

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Car size={22} strokeWidth={1.5} className="text-slate-400" />}
          title="No vehicles yet"
          description="Add your first vehicle to start receiving booking requests. Short on time? Send us the photos on WhatsApp and we will set it up for you."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/dashboard/vehicles/new" className={buttonClasses({ variant: "primary", size: "md" })}>
                <Plus size={16} aria-hidden="true" /> Add your first vehicle
              </Link>
              <a
                href={whatsappLink(`Hi DriveLink, please list my vehicle for me. Rental Page: ${agencyName} (${agencyId.slice(0, 8).toUpperCase()})`)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                <MessageCircle size={16} aria-hidden="true" /> List it for me
              </a>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => {
            const photo = v.photos?.[0];
            const needsAuthority = !v.listing_authority_declared
              || !v.listing_authority_basis
              || !v.listing_authority_confirmed_at
              || !v.listing_authority_confirmed_by;
            return (
              <Card key={v.id} padding="none" className="flex flex-col overflow-hidden">
                <div className="relative aspect-[16/9] bg-slate-100">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={`${v.year} ${v.make} ${v.model}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Car size={40} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={STATUS_VARIANT[v.status]}>
                      {STATUS_LABEL[v.status]}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {v.year} {v.make} {v.model}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">{v.city}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-semibold text-blue-600">
                        {formatLKR(v.daily_rate_lkr)}
                      </p>
                      <p className="text-xs text-slate-500">/ day</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="slate">{v.transmission}</Badge>
                    <Badge variant="slate">{v.seats} seats</Badge>
                    <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>
                      {insuranceLabel(v.insurance_type)}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="-ml-2 flex flex-wrap gap-0.5">
                      <Link
                        href={`/dashboard/vehicles/${v.id}/edit`}
                        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/vehicles/${v.id}/availability`}
                        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        Availability
                      </Link>
                      <Link
                        href={`/dashboard/vehicles/new?from=${v.id}`}
                        title="Start a new listing pre-filled from this one"
                        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        Duplicate
                      </Link>
                      <Link
                        href={`/vehicles/${v.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-100"
                      >
                        {v.status === "available" ? "View" : "Preview"} <ExternalLink size={12} aria-hidden="true" />
                      </Link>
                    </div>
                    {needsAuthority ? (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Owner review needed</span>
                    ) : (
                      <VehicleStatusToggle
                        vehicleId={v.id}
                        status={v.status}
                        rejectionReason={(v as { rejection_reason?: string | null }).rejection_reason}
                      />
                    )}
                  </div>

                  {needsAuthority && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-950">
                      {canDeclareListingAuthority
                        ? "Open Edit, check the details, confirm this page owns or is authorised to rent out this vehicle, then save. It goes to DriveLink review, or straight live once your page has an approved listing."
                        : "The vehicle stays private until a Rental Page owner or manager records the right-to-list declaration."}
                    </div>
                  )}

                  {/* UX-008: rejection reason + resubmit for review */}
                  {!needsAuthority && v.status === "unlisted" && (v as { rejection_reason?: string | null }).rejection_reason && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                      <p className="text-xs text-red-700"><span className="font-semibold">Rejected:</span> {(v as { rejection_reason?: string | null }).rejection_reason}</p>
                      <div className="mt-1.5"><ResubmitButton vehicleId={v.id} /></div>
                    </div>
                  )}

                  {/* Listings now go live with only the essentials, so point at
                      the details that help a renter choose, without asking for
                      them up front. */}
                  {!needsAuthority
                    && (v.status === "available" || v.status === "pending_review")
                    && !(v.features?.length)
                    && !v.description?.trim() && (
                    <Link
                      href={`/dashboard/vehicles/${v.id}/edit`}
                      className="mt-2 block rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs leading-5 text-blue-900 hover:bg-blue-100"
                    >
                      Improve this listing: add features and a short description so renters pick it.
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
