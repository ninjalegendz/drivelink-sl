"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Compass, Search, UserCog,
  LayoutDashboard, BarChart3, Car, ClipboardList, Users, Building2, Flag, Headphones, Settings, ScrollText,
  type LucideIcon,
} from "lucide-react";
import { CommandPalette, openCommandPalette } from "@/components/layout/CommandPalette";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import { BookingNotifier } from "@/components/realtime/BookingNotifier";
import { SignOutButton } from "@/components/account/SignOutButton";

// The admin workspace shell: same shape as the Rental Page dashboard (white
// sidebar, hairline edge, search, nav with count badges), plus the "Admin"
// pill so nobody mistakes which workspace they are in. This file is pure
// presentation; every auth check, redirect and count lives in
// src/app/(admin)/layout.tsx and arrives here as props.

// Icons are resolved from a key rather than accepted as a component prop.
// This is a client component, and the data-fetching server layout that
// builds `navItems` cannot hand a Server Component-imported function
// (a lucide icon) across the server/client boundary, that throws at
// runtime even though it type-checks. MobileNav next door uses the same
// keyed-icon pattern for the same reason.
export type AdminNavIcon =
  | "home" | "analytics" | "listings" | "bookings" | "users" | "agencies" | "reports" | "support" | "settings" | "activity";

const NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  home: LayoutDashboard,
  analytics: BarChart3,
  listings: Car,
  bookings: ClipboardList,
  users: Users,
  agencies: Building2,
  reports: Flag,
  support: Headphones,
  settings: Settings,
  activity: ScrollText,
};

export interface AdminNavItem {
  href: string;
  label: string;
  icon: AdminNavIcon;
  /** Omit or 0 to hide the pill. */
  count?: number;
  /** Red pill for "needs a reply now" items (support); blue for the rest. */
  urgent?: boolean;
}

interface Props {
  navItems: AdminNavItem[];
  mobilePrimary: MobileNavItem[];
  mobileSecondary: MobileNavItem[];
  children: React.ReactNode;
}

export function AdminShell({ navItems, mobilePrimary, mobileSecondary, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-canvas md:flex">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="fixed hidden h-full w-60 shrink-0 flex-col bg-white ring-1 ring-slate-900/[0.06] md:flex">
        <div className="flex items-center gap-2 px-5 pb-4 pt-5">
          <Link href="/admin" className="flex items-center" aria-label="DriveLink admin home">
            <Image src="/logo-horizontal.png" alt="DriveLink" width={1034} height={175} unoptimized priority className="h-6 w-auto shrink-0" />
          </Link>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/15">
            Admin
          </span>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-lg bg-slate-100/80 px-3.5 text-sm text-slate-500 ring-1 ring-inset ring-slate-900/[0.04] transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Search size={16} aria-hidden="true" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded-md bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 shadow-xs ring-1 ring-slate-900/[0.06]">/</kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {navItems.map(({ href, label, icon, count, urgent }) => {
            const active = isActive(pathname, href);
            const Icon = NAV_ICONS[icon];
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon size={17} className={active ? "text-blue-600" : "text-slate-400"} aria-hidden="true" />
                  {label}
                </span>
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular text-white ${
                      urgent ? "bg-rose-600" : "bg-blue-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-0.5 border-t border-slate-100 px-3 py-3">
          <Link href="/vehicles" className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            <Compass size={16} className="text-slate-400" aria-hidden="true" /> Back to marketplace
          </Link>
          <Link href="/account/settings" className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            <UserCog size={16} className="text-slate-400" aria-hidden="true" /> My account
          </Link>
          <div className="px-3 py-1.5">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Mobile top bar: slim, sticky, safe-area aware. The tab bar at the
          bottom carries navigation, so this only needs the brand mark and
          search. */}
      <header className="glass-bar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Link href="/admin" className="flex items-center gap-2" aria-label="DriveLink admin home">
          <Image src="/logo-horizontal.png" alt="DriveLink" width={1034} height={175} unoptimized priority className="h-5 w-auto shrink-0" />
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/15">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search"
          className="grid h-10 w-10 place-items-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Search size={20} />
        </button>
      </header>

      {/* Content */}
      <main className="max-w-full min-w-0 flex-1 p-4 pb-28 md:ml-60 md:p-8 md:pb-8">{children}</main>

      <MobileNav primary={mobilePrimary} secondary={mobileSecondary} />

      {/* Admins see every new booking land in real-time. No agencyId = no filter. */}
      <BookingNotifier viewHref="/admin/bookings" />

      <CommandPalette context={{ signedIn: true, ownsPages: false, isAdmin: true }} />
    </div>
  );
}

/** Mirrors the tab bar's rule: only the most specific match should read as active. */
function isActive(pathname: string, href: string): boolean {
  // Home is a prefix of every admin path, so it only counts on an exact match
  // (the /design mirror included, or every preview lit up Home as well).
  if (href === "/admin" || href === "/design/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
