"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MoreHorizontal, X,
  Car, Compass, CalendarCheck, User, Tag, HelpCircle, Building2,
  LayoutDashboard, BarChart3, Headphones, Settings,
  ReceiptText, Users, Ban, Mail, Receipt, Landmark, ClipboardList,
} from "lucide-react";

// Icon names allowed in MobileNav items. Strings cross the Server →
// Client boundary cleanly; passing component references (functions)
// triggers React's "Functions cannot be passed directly to Client
// Components" error in App Router.
export type MobileNavIcon =
  | "browse" | "bookings" | "account" | "signin" | "fleet" | "dashboard"
  | "home" | "analytics" | "support" | "settings" | "slips" | "listings"
  | "users" | "agencies" | "blacklist" | "email" | "invoices" | "bank"
  | "pricing" | "faq" | "car" | "all-bookings";

const ICONS: Record<MobileNavIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  browse:        Compass,
  bookings:      CalendarCheck,
  account:       User,
  signin:        User,
  fleet:         Car,
  dashboard:     Building2,
  home:          LayoutDashboard,
  analytics:     BarChart3,
  support:       Headphones,
  settings:      Settings,
  slips:         ReceiptText,
  listings:      Car,
  users:         Users,
  agencies:      Building2,
  blacklist:     Ban,
  email:         Mail,
  invoices:      Receipt,
  bank:          Landmark,
  pricing:       Tag,
  faq:           HelpCircle,
  car:           Car,
  "all-bookings": ClipboardList,
};

export interface MobileNavItem {
  href:   string;
  label:  string;
  icon:   MobileNavIcon;
  badge?: string | number;
}

interface Props {
  primary:    MobileNavItem[];
  secondary?: MobileNavItem[];
  /** When true, the bar only renders inside a Capacitor native app (hidden on plain mobile web). */
  requireApp?: boolean;
}

export function MobileNav({ primary, secondary = [], requireApp = false }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Default to "visible" so admin/dashboard mobile-web users still get nav.
  // When requireApp is true (marketplace), we start hidden and flip on after
  // detecting window.Capacitor.isNativePlatform() so the bar only shows up
  // inside the Capacitor-wrapped installable app.
  const [allowed, setAllowed] = useState(!requireApp);

  useEffect(() => {
    if (!requireApp) return;
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    setAllowed(w.Capacitor?.isNativePlatform?.() === true);
  }, [requireApp]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMoreOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [moreOpen]);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (!allowed) return null;

  const hasSecondary = secondary.length > 0;
  const primaryCount = hasSecondary ? Math.min(primary.length, 3) : primary.length;
  const totalCols = primaryCount + (hasSecondary ? 1 : 0);
  const gridCols =
    totalCols >= 4 ? "grid-cols-4" :
    totalCols === 3 ? "grid-cols-3" :
    totalCols === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong">
        <div className={`grid ${gridCols} px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]`}>
          {primary.slice(0, primaryCount).map((item) => (
            <MobileTab
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
          {hasSecondary && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="spring-press flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-slate-500 hover:text-amber-500"
            >
              <MoreHorizontal size={20} />
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {hasSecondary && moreOpen && (
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
              <p className="text-slate-200 font-semibold text-base">More</p>
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
              {secondary.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="spring-press flex items-center justify-between gap-3 px-4 py-3 rounded-2xl glass-card transition-all"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full glass flex items-center justify-center text-amber-500">
                          <Icon size={16} />
                        </span>
                        <span className="text-slate-200 font-medium text-sm">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pop-in">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function MobileTab({ item, active }: { item: MobileNavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      className={`spring-press relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors ${
        active ? "text-amber-500" : "text-slate-500 hover:text-amber-500"
      }`}
    >
      <span className={`relative inline-flex items-center justify-center ${active ? "scale-105" : ""}`}>
        <Icon size={20} />
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
  return pathname === href || pathname.startsWith(href + "/");
}
