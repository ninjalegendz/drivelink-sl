"use client";

import Link from "next/link";
import { ExternalLink, Copy } from "lucide-react";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { VehicleStatusToggle } from "@/components/dashboard/VehicleStatusToggle";
import type { VehicleStatus } from "@/types/database";

interface Props {
  vehicleId: string;
  slug: string;
  status: VehicleStatus;
  rejectionReason?: string | null;
  /** True while the page's right-to-list declaration is still outstanding: no status toggle to offer yet. */
  needsAuthority: boolean;
}

/**
 * One tidy action row per fleet card. Edit and Availability are used often
 * enough to stay one tap away; viewing the public listing and Duplicate sit
 * in the overflow menu, which keeps the row on one line on a phone. The
 * list/unlist toggle stays its own small button at the end: it owns its own
 * fetch and inline error, and a menu item would lose the place to show it.
 */
export function FleetCardActions({ vehicleId, slug, status, rejectionReason, needsAuthority }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="-ml-2 flex flex-wrap items-center gap-0.5">
        <Link
          href={`/dashboard/vehicles/${vehicleId}/edit`}
          className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          Edit
        </Link>
        <Link
          href={`/dashboard/vehicles/${vehicleId}/availability`}
          className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Availability
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <OverflowMenu
          label="More vehicle actions"
          items={[
            {
              label: status === "available" ? "View live listing" : "Preview listing",
              icon: ExternalLink,
              href: `/vehicles/${slug}`,
              newTab: true,
            },
            {
              label: "Duplicate",
              icon: Copy,
              href: `/dashboard/vehicles/new?from=${vehicleId}`,
            },
          ]}
        />
        {!needsAuthority && (
          <VehicleStatusToggle vehicleId={vehicleId} status={status} rejectionReason={rejectionReason} />
        )}
      </div>
    </div>
  );
}
