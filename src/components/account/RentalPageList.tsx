"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Car } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

const MAX_PAGES = 5;

function Avatar({ page }: { page: RentalPageListEntry }) {
  if (page.logo_url) {
    return (
      <Image
        src={page.logo_url}
        alt={page.name}
        width={40}
        height={40}
        unoptimized
        className="rounded-xl object-cover shrink-0 w-10 h-10"
      />
    );
  }
  return (
    <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 font-semibold flex items-center justify-center shrink-0 text-base">
      {page.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Lists every Rental Page the account owns, tap one to switch the dashboard to it. */
export function RentalPageList({ pages }: Props) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  async function openPage(pageId: string) {
    setSwitching(pageId);
    await fetch("/api/pages/switch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ page_id: pageId }),
    });
    router.push("/dashboard");
  }

  if (pages.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 text-center">
        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <Car size={18} />
        </div>
        <h2 className="text-slate-900 font-semibold">Rent out your vehicle</h2>
        <p className="text-slate-500 text-xs mt-1 mb-4">
          Create your first Rental Page — free, and it takes two minutes.
        </p>
        <Link href="/account/pages/new">
          <Button className="w-full">Create Rental Page</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <h2 className="text-slate-900 font-semibold mb-4">My Rental Pages</h2>

      <div className="space-y-2">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => openPage(page.id)}
            disabled={switching !== null}
            className="spring-press w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors disabled:opacity-50 text-left"
          >
            <Avatar page={page} />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-900 font-medium text-sm truncate">{page.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                  {page.page_type === "business" ? "Business" : "Personal"}
                </span>
                {page.page_type === "business" && !page.is_verified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                    Pending review
                  </span>
                )}
              </span>
              <span className="block text-slate-500 text-xs mt-0.5 truncate">{page.city}</span>
            </span>
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
          </button>
        ))}
      </div>

      {pages.length >= MAX_PAGES ? (
        <p className="text-slate-400 text-xs mt-3 text-center">{pages.length} of {MAX_PAGES} pages</p>
      ) : (
        <Link
          href="/account/pages/new"
          className="mt-3 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 text-sm"
        >
          <Plus size={14} /> Create Rental Page
        </Link>
      )}
    </div>
  );
}
