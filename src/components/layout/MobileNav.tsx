"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";

export interface MobileNavItem {
  href:    string;
  label:   string;
  Icon:    React.ComponentType<{ size?: number; className?: string }>;
  badge?:  string | number;
}

interface Props {
  /** Main 3 items shown directly on the bottom bar */
  primary:   MobileNavItem[];
  /** Spillover surface — opened by tapping More */
  secondary: MobileNavItem[];
}

export function MobileNav({ primary, secondary }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMoreOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [moreOpen]);

  // Close sheet whenever route changes
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong">
        <div className="grid grid-cols-4 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {primary.slice(0, 3).map((item) => (
            <MobileTab
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="spring-press flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-slate-500 hover:text-amber-400"
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="glass-strong rounded-t-3xl px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-1 pb-3">
              <div className="w-12 h-1 bg-stone-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-900 font-semibold text-base">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-9 h-9 rounded-full glass flex items-center justify-center text-slate-500"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-1.5 pb-2">
              {secondary.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="spring-press flex items-center justify-between gap-3 px-4 py-3 rounded-2xl glass-card hover:glass-tint transition-all"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full glass flex items-center justify-center text-amber-400">
                        <item.Icon size={16} />
                      </span>
                      <span className="text-slate-900 font-medium text-sm">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pop-in">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function MobileTab({ item, active }: { item: MobileNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`spring-press relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors ${
        active ? "text-amber-500" : "text-slate-500 hover:text-amber-400"
      }`}
    >
      <span className={`relative inline-flex items-center justify-center ${active ? "scale-105" : ""}`}>
        <item.Icon size={20} />
        {item.badge && (
          <span className="absolute -top-1.5 -right-2 text-[9px] font-bold bg-red-500 text-white min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center animate-pop-in">
            {item.badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{item.label}</span>
      {active && <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-amber-500" />}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Match exact or as a path prefix segment (avoid /admin matching /admin/anything-not-segment-boundary)
  return pathname === href || pathname.startsWith(href + "/");
}
