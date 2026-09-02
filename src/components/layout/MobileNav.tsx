"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Car, Compass, CalendarCheck, User, Tag, HelpCircle, Building2,
  LayoutDashboard, BarChart3, Headphones, Settings,
  Users, Ban, Mail, ClipboardList,
  Bell, MessageSquare, Sparkles, ShieldAlert, CirclePlay,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

export type MobileNavIcon =
  | "browse" | "bookings" | "account" | "signin" | "fleet" | "dashboard"
  | "home" | "analytics" | "support" | "settings" | "listings"
  | "users" | "agencies" | "blacklist" | "email"
  | "pricing" | "faq" | "guides" | "car" | "all-bookings" | "notifications"
  | "requests" | "directory" | "cases";

const ICONS: Record<MobileNavIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  browse: Compass,
  bookings: CalendarCheck,
  account: User,
  signin: User,
  fleet: Car,
  dashboard: Building2,
  home: LayoutDashboard,
  analytics: BarChart3,
  support: Headphones,
  settings: Settings,
  listings: Car,
  users: Users,
  agencies: Building2,
  blacklist: Ban,
  email: Mail,
  pricing: Tag,
  faq: HelpCircle,
  guides: CirclePlay,
  car: Car,
  "all-bookings": ClipboardList,
  notifications: Bell,
  requests: MessageSquare,
  directory: Sparkles,
  cases: ShieldAlert,
};

export interface MobileNavItem {
  href: string;
  label: string;
  icon: MobileNavIcon;
  badge?: string | number;
}

interface Props {
  primary: MobileNavItem[];
  secondary?: MobileNavItem[];
  /** Rendered at the top of the More sheet, above the links. Used by the
   *  dashboard for the Rental Page switcher, which is infrequent enough that
   *  it does not deserve permanent space on every screen. */
  extra?: React.ReactNode;
}

export function MobileNav({ primary, secondary = [], extra }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleSecondary = secondary.filter((item) => !primary.some((primaryItem) => primaryItem.href === item.href));

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Resolved across every destination in the bar, primary and secondary, so a
  // page reachable only from "More" does not light up a primary tab instead.
  const current = activeHref(pathname, [...primary, ...visibleSecondary].map((i) => i.href));

  const hasSecondary = visibleSecondary.length > 0 || Boolean(extra);
  const primaryCount = hasSecondary ? Math.min(primary.length, 3) : primary.length;
  const totalCols = primaryCount + (hasSecondary ? 1 : 0);
  const gridCols =
    totalCols >= 4 ? "grid-cols-4" :
    totalCols === 3 ? "grid-cols-3" :
    totalCols === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden" aria-label="Primary navigation">
        <div className={`grid ${gridCols} px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]`}>
          {primary.slice(0, primaryCount).map((item) => (
            <MobileTab key={item.href} item={item} active={current === item.href.split("?")[0]} />
          ))}
          {hasSecondary && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            >
              <MoreHorizontal size={20} aria-hidden="true" />
              <span className="text-xs font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {hasSecondary && moreOpen && (
        <BottomSheet title="More" closeLabel="Close more navigation" onClose={() => setMoreOpen(false)} className="md:hidden">
          <div className="max-h-[70dvh] overflow-y-auto">
          {extra && <div className="border-b border-slate-200 px-3 py-3">{extra}</div>}
          <ul className="space-y-1 px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {visibleSecondary.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

function MobileTab({ item, active }: { item: MobileNavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-colors ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span className="relative inline-flex items-center justify-center">
        <Icon size={20} aria-hidden="true" />
        {item.badge && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {item.badge}
          </span>
        )}
      </span>
      <span className="text-xs font-medium">{item.label}</span>
    </Link>
  );
}

/**
 * Which tab, if any, the current page belongs to.
 *
 * Testing each tab on its own lights up every ancestor: on /dashboard/bookings
 * both "Home" (/dashboard) and "Bookings" matched, so two tabs read as current
 * and the bar stopped saying where you are. Only the most specific match wins.
 */
function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const path = href.split("?")[0];
    const matches = path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
    if (matches && (best === null || path.length > best.length)) best = path;
  }
  return best;
}
