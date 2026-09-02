"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Check, Plus } from "lucide-react";
import type { PageSwitcherEntry } from "@/components/dashboard/PageSwitcher";

interface Props {
  activePage: PageSwitcherEntry;
  pages: PageSwitcherEntry[];
  onNavigate?: () => void;
}

/**
 * The Rental Page switcher, shaped for the mobile "More" sheet.
 *
 * The dashboard's switcher is a dropdown, which is the wrong shape inside a
 * sheet: a menu opening out of a menu, with the panel fighting the sheet for
 * room. A sheet is already a list, so this is just the list. It also gets the
 * switcher off the top of every dashboard screen, where it was charging
 * permanent vertical space for something most owners do once.
 */
export function PageSwitcherList({ activePage, pages, onNavigate }: Props) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();

  useEffect(() => { if (!refreshing) setSwitching(null); }, [refreshing]);

  async function switchTo(pageId: string) {
    if (switching || pageId === activePage.id) return;
    setSwitching(pageId);
    try {
      await fetch("/api/pages/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });
      startTransition(() => router.refresh());
    } catch {
      setSwitching(null);
    }
  }

  return (
    <div>
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Rental {pages.length === 1 ? "Page" : "Pages"}
      </p>

      <ul className="space-y-1">
        {pages.map((page) => {
          const isActive = page.id === activePage.id;
          const isBusy = switching === page.id;
          return (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => switchTo(page.id)}
                disabled={Boolean(switching) || isActive}
                aria-current={isActive ? "true" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-default ${
                  isActive ? "bg-blue-50" : "hover:bg-slate-100"
                }`}
              >
                {isBusy ? (
                  <span aria-hidden="true" className="h-9 w-9 shrink-0 animate-spin rounded-lg border-2 border-blue-200 border-t-blue-600" />
                ) : page.logo_url ? (
                  <Image
                    src={page.logo_url}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 font-semibold text-blue-700">
                    {page.name.charAt(0).toUpperCase()}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{page.name}</span>
                  <span className="block text-xs text-slate-500">
                    {page.page_type === "business" ? "Business" : "Personal"}
                  </span>
                </span>

                {isActive && <Check size={16} className="shrink-0 text-blue-700" aria-label="Current page" />}
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href="/account/pages/new"
        onClick={onNavigate}
        className="mt-1 flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50">
          <Plus size={16} aria-hidden="true" />
        </span>
        Create a Rental Page
      </Link>
    </div>
  );
}
