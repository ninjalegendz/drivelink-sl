"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Car, Compass, CalendarCheck, User, Tag, HelpCircle, Building2,
  LayoutDashboard, BarChart3, Headphones, Settings,
  Users, Ban, Mail, ClipboardList,
  Bell, MessageSquare, Sparkles, ShieldAlert, CirclePlay, ScrollText,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

export type MobileNavIcon =
  | "browse" | "bookings" | "account" | "signin" | "fleet" | "dashboard"
  | "home" | "analytics" | "support" | "settings" | "listings"
  | "users" | "agencies" | "blacklist" | "email"
  | "pricing" | "faq" | "guides" | "car" | "all-bookings" | "notifications"
  | "requests" | "directory" | "cases" | "activity";

const ICONS: Record<MobileNavIcon, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
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
  activity: ScrollText,
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
      {/* Floating, frosted, thumb-height. It is lifted off the screen edge so
          it never collides with the Android gesture bar, and it reads as part
          of the app rather than a strip of browser chrome. */}
      <nav
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden"
        aria-label="Primary navigation"
      >
        <div className={`glass-bar grid ${gridCols} h-16 items-stretch gap-1 rounded-[1.375rem] p-1.5 shadow-lg ring-1 ring-slate-900/[0.08]`}>
          {primary.slice(0, primaryCount).map((item) => (
            <MobileTab key={item.href} item={item} active={current === item.href.split("?")[0]} />
          ))}
          {hasSecondary && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="spring-press flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-slate-500 hover:text-slate-900"
            >
              <MoreHorizontal size={21} aria-hidden="true" />
              <span className="text-xs font-medium leading-none">More</span>
            </button>
          )}
        </div>
      </nav>

      {hasSecondary && moreOpen && (
        <BottomSheet title="More" closeLabel="Close more navigation" onClose={() => setMoreOpen(false)} className="md:hidden">
          <div className="max-h-[70dvh] overflow-y-auto">
          {extra && <div className="border-b border-slate-100 px-4 py-3">{extra}</div>}
          <ul className="grid grid-cols-2 gap-2 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {visibleSecondary.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="spring-press relative flex min-h-[5.25rem] flex-col justify-between gap-3 rounded-2xl bg-slate-50 p-3.5 text-slate-800 ring-1 ring-inset ring-slate-900/[0.04] hover:bg-slate-100"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/[0.06]">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium leading-tight">{item.label}</span>
                    {item.badge && (
                      <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
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
      aria-current={active ? "page" : undefined}
      className={`spring-press relative flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 transition-colors ${
        active ? "bg-blue-600/[0.08] text-blue-700" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <span className="relative inline-flex items-center justify-center">
        <Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
        {item.badge && (
          <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold leading-none text-white ring-2 ring-white">
            {item.badge}
          </span>
        )}
      </span>
      <span className={`text-xs leading-none ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
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
