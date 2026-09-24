"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarCheck, Car, BarChart3, Headphones,
  Search, Settings, User, ChevronRight, Compass,
} from "lucide-react";
import { PageSwitcher, type PageSwitcherEntry } from "@/components/dashboard/PageSwitcher";
import { PageSwitcherList } from "@/components/dashboard/PageSwitcherList";
import { PageNotLiveBanner } from "@/components/dashboard/PageNotLiveBanner";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import { CommandPalette, openCommandPalette } from "@/components/layout/CommandPalette";
import { BookingNotifier } from "@/components/realtime/BookingNotifier";
import { SignOutButton } from "@/components/account/SignOutButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "@/components/layout/NavbarShell";
import type { LivenessBlocker } from "@/lib/pages/liveness";

export type DashboardNavIcon = "today" | "bookings" | "fleet" | "analytics" | "support";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: DashboardNavIcon;
  /** e.g. "NEW" on Support once admin has replied. */
  badge?: string;
}

const NAV_ICONS: Record<DashboardNavIcon, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  today: LayoutDashboard,
  bookings: CalendarCheck,
  fleet: Car,
  analytics: BarChart3,
  support: Headphones,
};

export interface DashboardShellProps {
  activePage: PageSwitcherEntry | null;
  pageOptions: PageSwitcherEntry[];
  /** Desktop sidebar nav, already filtered by capability and in display order. */
  navItems: DashboardNavItem[];
  mobilePrimary: MobileNavItem[];
  mobileSecondary: MobileNavItem[];
  canManagePage: boolean;
  blocker: LivenessBlocker | null;
  pageId: string | null;
  canViewBookings: boolean;
  isAdmin?: boolean;
  children: React.ReactNode;
}

/**
 * The signed-in Rental Page workspace shell: desktop sidebar, mobile sticky
 * top bar + floating tab bar, the "page not live" banner and the realtime
 * booking toasts. Every /dashboard screen renders inside this; it carries no
 * page-specific content itself, only the chrome around `children`.
 *
 * This is presentation only. All permission checks, redirects and data
 * fetching stay in (dashboard)/layout.tsx, which computes `navItems` etc. and
 * passes them down already filtered, so this component never has to know
 * what a "capability" is.
 */
export function DashboardShell({
  activePage, pageOptions, navItems, mobilePrimary, mobileSecondary,
  canManagePage, blocker, pageId, canViewBookings, isAdmin = false, children,
}: DashboardShellProps) {
  const pathname = usePathname();
  // Shortcut hint in the reader's own keyboard language, same rule as NavbarShell.
  const [modKey, setModKey] = useState("Ctrl");
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setModKey("⌘");
  }, []);

  // Most-specific-match wins, same rule as MobileNav's activeHref: on
  // /dashboard/bookings, "Today" (/dashboard) must not also read as current.
  const activeHref = useMemo(() => {
    let best: string | null = null;
    for (const item of navItems) {
      const matches = pathname === item.href || pathname.startsWith(item.href + "/");
      if (matches && (best === null || item.href.length > best.length)) best = item.href;
    }
    return best;
  }, [navItems, pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-900/[0.06] bg-white md:flex">
        <div className="px-5 pt-6">
          <Link href="/" className="flex items-center" aria-label="DriveLink home">
            <Image src="/logo-horizontal.png" alt="DriveLink" width={1034} height={175} unoptimized priority className="h-6 w-auto" />
          </Link>
        </div>

        <div className="space-y-1 px-3 pt-5">
          {activePage && <PageSwitcher activePage={activePage} pages={pageOptions} />}

          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-10 w-full items-center gap-2.5 rounded-lg bg-slate-100/80 pl-3 pr-2 text-sm text-slate-500 ring-1 ring-inset ring-slate-900/[0.04] transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Search size={15} aria-hidden="true" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded-md bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 shadow-xs ring-1 ring-slate-900/[0.06]">
              {modKey} K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-4" aria-label="Dashboard">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`spring-press flex min-h-10 items-center justify-between gap-2.5 rounded-lg px-3 text-sm transition-colors ${
                  active ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-blue-600" : "text-slate-400"} />
                  {item.label}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white animate-pop-in">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-0.5 border-t border-slate-100 px-3 py-3">
          {canManagePage && (
            <Link href="/dashboard/settings" className="spring-press flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900">
              <Settings size={16} className="text-slate-400" aria-hidden="true" /> Page settings
            </Link>
          )}
          <Link href="/account" className="spring-press flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900">
            <User size={16} className="text-slate-400" aria-hidden="true" /> Account
          </Link>
          <Link href="/account/settings" className="spring-press flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900">
            <Settings size={16} className="text-slate-400" aria-hidden="true" /> Settings
          </Link>
          <Link href="/" className="spring-press flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900">
            <Compass size={16} className="text-slate-400" aria-hidden="true" /> Back to marketplace
          </Link>
          <div className="px-3 pt-1"><SignOutButton /></div>
        </div>
      </aside>

      {/* Mobile sticky top bar: page switcher trigger + search. The floating
          MobileNav below still carries the primary/secondary destinations. */}
      {activePage && (
        <header className="glass-bar sticky top-0 z-30 flex h-14 items-center gap-1 px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            type="button"
            onClick={() => setMobileSwitcherOpen(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left"
          >
            <Avatar name={activePage.name} avatarUrl={activePage.logo_url} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{activePage.name}</span>
            <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Search"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <Search size={19} aria-hidden="true" />
          </button>
        </header>
      )}

      {mobileSwitcherOpen && activePage && (
        <BottomSheet title="Switch Rental Page" closeLabel="Close switcher" onClose={() => setMobileSwitcherOpen(false)}>
          <div className="max-h-[70dvh] overflow-y-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <PageSwitcherList activePage={activePage} pages={pageOptions} onNavigate={() => setMobileSwitcherOpen(false)} />
          </div>
        </BottomSheet>
      )}

      {/* Content, full width on mobile, offset for the sidebar on md+ */}
      <main className="min-h-screen pb-28 pt-4 md:ml-64 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8">
          {blocker && pageId && <PageNotLiveBanner blocker={blocker} pageId={pageId} />}
          {children}
        </div>
      </main>

      <MobileNav
        primary={mobilePrimary}
        secondary={mobileSecondary}
        extra={activePage ? <PageSwitcherList activePage={activePage} pages={pageOptions} /> : undefined}
      />

      {/* Live booking-request toasts + sound + OS push, scoped to this page. */}
      {pageId && canViewBookings && <BookingNotifier agencyId={pageId} viewHref="/dashboard/bookings" />}

      <CommandPalette context={{ signedIn: true, ownsPages: true, isAdmin }} />
    </div>
  );
}
