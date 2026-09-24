"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Car } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";

export interface RentalPageListEntry {
  id:          string;
  name:        string;
  page_type:   "personal" | "business";
  city:        string;
  is_verified: boolean;
  logo_url:    string | null;
}

interface Props {
  pages: RentalPageListEntry[];
}

function PageLogo({ page }: { page: RentalPageListEntry }) {
  if (page.logo_url) {
    return (
      <Image
        src={page.logo_url}
        alt={page.name}
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-800 text-lg font-semibold text-white">
      {page.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Lists every Rental Page the account owns, tap one to switch the dashboard to it. */
export function RentalPageList({ pages }: Props) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  // `switching` stays set through the navigation, so the row keeps showing it
  // is the one being opened until the dashboard actually appears.
  async function openPage(pageId: string) {
    if (switching) return;
    setSwitching(pageId);
    try {
      await fetch("/api/pages/switch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ page_id: pageId }),
      });
      startNavigationProgress();
      router.push("/dashboard");
    } catch {
      setSwitching(null);
    }
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-6 text-center shadow-xs ring-1 ring-slate-900/[0.06] sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <Car size={20} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">Rent out your vehicle</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
          Create your first Rental Page. Free, and it takes two minutes.
        </p>
        <Link href="/account/pages/new" className={buttonClasses({ size: "lg", className: "mt-5" })}>
          Create Rental Page
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">My Rental Pages</h2>

      <div className="mt-4 space-y-3">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => openPage(page.id)}
            disabled={switching !== null}
            className="spring-hover flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:ring-blue-200 disabled:opacity-50 sm:p-5"
          >
            {switching === page.id
              ? <span aria-hidden="true" className="h-12 w-12 shrink-0 animate-spin rounded-xl border-2 border-blue-200 border-t-blue-600" />
              : <PageLogo page={page} />}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-slate-900">{page.name}</span>
                <Badge variant="slate" dot={false}>{page.page_type === "business" ? "Business" : "Personal"}</Badge>
                {page.page_type === "business" && !page.is_verified && (
                  <Badge variant="amber">Pending review</Badge>
                )}
              </span>
              {/* Every page listed here is owned by this account (getOwnedPages
                  only returns owned pages), so the role is always "Owner". */}
              <span className="mt-0.5 block truncate text-xs text-slate-500">{page.city} · Owner</span>
            </span>
            <span className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-700 sm:inline-flex">
              Open dashboard <ArrowRight size={15} aria-hidden="true" />
            </span>
            <ArrowRight size={16} className="shrink-0 text-slate-300 sm:hidden" aria-hidden="true" />
          </button>
        ))}
      </div>

      <Link
        href="/account/pages/new"
        className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        <Plus size={14} /> Create Rental Page
      </Link>
      <p className="mt-1 text-xs text-slate-500">No lifetime page limit. Create a separate page only for a distinct rental brand, location, or service.</p>
    </div>
  );
}
