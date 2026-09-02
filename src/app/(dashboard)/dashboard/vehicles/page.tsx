import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Car, Plus, ExternalLink } from "lucide-react";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { Badge } from "@/components/ui/Badge";
import { VehicleStatusToggle } from "@/components/dashboard/VehicleStatusToggle";
import { ResubmitButton } from "@/components/dashboard/ResubmitButton";
import { DismissNotice } from "@/components/dashboard/DismissNotice";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
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

interface Props {
  searchParams: Promise<{ documents?: string; authority?: string; photos?: string }>;
}

export default async function FleetPage({ searchParams }: Props) {
  const { documents, authority, photos } = await searchParams;
  const failedPhotoCount = Number(photos) > 0 ? Number(photos) : 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/vehicles");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const agency = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("manage_fleet")) redirect("/dashboard");
  const canDeclareListingAuthority = pageAccess.capabilities.includes("declare_listing_authority");

  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  const vehicles = (data ?? []) as VehicleRow[];

  return (
    <div>
      <div className="mb-8">
        <PageHeader
          title="Fleet"
          description={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} on this Rental Page.`}
          actions={
            <Link
              href="/dashboard/vehicles/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={16} /> Add vehicle
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

      {documents === "retry" && (
        <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your listing was submitted, but its private document upload did not finish. Open the listing and upload the documents again.
          <DismissNotice />
        </div>
      )}

      {authority === "owner-review" && (
        <div role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Vehicle details were saved privately. A Rental Page owner or manager must open the listing, confirm the page&apos;s right to list it, and submit it for DriveLink review.
          <DismissNotice />
        </div>
      )}

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Car size={22} strokeWidth={1.5} className="text-slate-400" />}
          title="No vehicles yet"
          description="Add your first vehicle to start receiving booking requests."
          action={
            <Link
              href="/dashboard/vehicles/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={16} /> Add your first vehicle
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map((v) => {
            const photo = v.photos?.[0];
            const needsAuthority = !v.listing_authority_declared
              || !v.listing_authority_basis
              || !v.listing_authority_confirmed_at
              || !v.listing_authority_confirmed_by;
            return (
              <div
                key={v.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col"
              >
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
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Car size={40} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={STATUS_VARIANT[v.status]}>
                      {STATUS_LABEL[v.status]}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">
                        {v.year} {v.make} {v.model}
                      </h3>
                      <p className="text-slate-600 text-xs mt-0.5">{v.city}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-blue-600 font-bold text-sm">
                        {formatLKR(v.daily_rate_lkr)}
                      </p>
                      <p className="text-slate-500 text-xs">/ day</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge variant="slate">{v.transmission}</Badge>
                    <Badge variant="slate">{v.seats} seats</Badge>
                    <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>
                      {insuranceLabel(v.insurance_type)}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-0.5 -ml-2">
                      <Link
                        href={`/dashboard/vehicles/${v.id}/edit`}
                        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/vehicles/${v.id}/availability`}
                        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Availability
                      </Link>
                      <Link
                        href={`/dashboard/vehicles/new?from=${v.id}`}
                        title="Start a new listing pre-filled from this one"
                        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Duplicate
                      </Link>
                      <Link
                        href={`/vehicles/${v.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        {v.status === "available" ? "View" : "Preview"} <ExternalLink size={12} />
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
                        ? "Open Edit, confirm whether the page owns or is authorised to operate this vehicle, then save it for DriveLink review."
                        : "The vehicle stays private until a Rental Page owner or manager records the right-to-list declaration."}
                    </div>
                  )}

                  {/* UX-008: rejection reason + resubmit for review */}
                  {!needsAuthority && v.status === "unlisted" && (v as { rejection_reason?: string | null }).rejection_reason && (
                    <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
                      <p className="text-red-700 text-xs"><span className="font-semibold">Rejected:</span> {(v as { rejection_reason?: string | null }).rejection_reason}</p>
                      <div className="mt-1.5"><ResubmitButton vehicleId={v.id} /></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
