"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, ArrowLeftRight } from "lucide-react";

export interface PageSwitcherEntry {
  id:        string;
  name:      string;
  page_type: "personal" | "business";
  logo_url:  string | null;
}

interface Props {
  activePage: PageSwitcherEntry;
  pages:      PageSwitcherEntry[];
}

function Avatar({ page, size = 28 }: { page: PageSwitcherEntry; size?: number }) {
  if (page.logo_url) {
    return (
      <Image
        src={page.logo_url}
        alt={page.name}
        width={size}
        height={size}
        unoptimized
        className="rounded-lg object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-lg bg-blue-100 text-blue-600 font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {page.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Compact switcher for the sidebar, jump between the account's Rental Pages. */
export function PageSwitcher({ activePage, pages }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const others = pages.filter((p) => p.id !== activePage.id);

  async function switchTo(pageId: string) {
    setSwitching(pageId);
    await fetch("/api/pages/switch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ page_id: pageId }),
    });
    setSwitching(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="spring-press w-full flex items-center gap-2 px-2 py-2 rounded-xl glass hover:bg-white/60 transition-colors text-left"
      >
        <Avatar page={activePage} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-900 truncate">{activePage.name}</span>
          <span className="block text-[11px] text-slate-500">
            {activePage.page_type === "business" ? "Business" : "Personal"}
          </span>
        </span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 text-sm">
            {others.length > 0 && (
              <div className="space-y-0.5 mb-1.5 pb-1.5 border-b border-slate-100">
                {others.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchTo(p.id)}
                    disabled={switching !== null}
                    className="spring-press w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 text-left"
                  >
                    <Avatar page={p} size={22} />
                    <span className="flex-1 min-w-0 truncate text-slate-700">{p.name}</span>
                    {switching === p.id && (
                      <ArrowLeftRight size={12} className="text-slate-400 animate-pulse shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <Link
              href="/account/pages/new"
              onClick={() => setOpen(false)}
              className="spring-press flex items-center gap-2 px-2 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus size={14} /> Create Rental Page
            </Link>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="spring-press flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              Back to my account
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
