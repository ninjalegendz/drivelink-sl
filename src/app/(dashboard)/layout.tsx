import { redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import Link from "next/link";
import Image from "next/image";
import { Settings, User, Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess, type PageCapability } from "@/lib/pages/access";
import { SignOutButton } from "@/components/account/SignOutButton";
import { PageSwitcher, type PageSwitcherEntry } from "@/components/dashboard/PageSwitcher";
import { PageSwitcherList } from "@/components/dashboard/PageSwitcherList";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import { BookingNotifier } from "@/components/realtime/BookingNotifier";
import { PageNotLiveBanner } from "@/components/dashboard/PageNotLiveBanner";
import { getPageLiveness } from "@/lib/pages/liveness";
import type { LivenessBlocker } from "@/lib/pages/liveness";

const NAV: { href: string; label: string; capability?: PageCapability }[] = [
  { href: "/dashboard",           label: "Overview" },
  { href: "/dashboard/analytics", label: "Analytics", capability: "view_analytics" },
  { href: "/dashboard/vehicles",  label: "Fleet", capability: "manage_fleet" },
  { href: "/dashboard/bookings",  label: "Bookings", capability: "view_bookings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Surface a "new reply" indicator on the Support link so the page owner
  // knows when admin has responded without having to open the page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let supportUnread = false;
  let pageId: string | null = null;
  let activePage: PageSwitcherEntry | null = null;
  let pageOptions: PageSwitcherEntry[] = [];
  let capabilities = new Set<PageCapability>();
  let canSupport = false;
  let canManagePage = false;
  // Why the active page is invisible to renters, if it is. Shown on every
  // dashboard screen, because an owner who cannot see this has no way to tell
  // "no enquiries yet" apart from "no renter can see me".
  let blocker: LivenessBlocker | null = null;

  if (user) {
    // Page staff are held to the same identity check as everyone else.
    await requireVerifiedIdentity("/dashboard");
    const { page, pages } = await getActivePage(supabase, user.id);
    if (!page) redirect("/account/pages/new");

    pageId = page.id;
    const access = await getPageAccess(supabase, user.id, page.id);
    capabilities = new Set(access.capabilities);
    canSupport = capabilities.has("manage_support");
    canManagePage = capabilities.has("manage_page");
    activePage = { id: page.id, name: page.name, page_type: page.page_type, logo_url: page.logo_url };
    pageOptions = pages.map((p) => ({ id: p.id, name: p.name, page_type: p.page_type, logo_url: p.logo_url }));

    const { data: thread } = await supabase
      .from("support_threads")
      .select("has_unread_agency")
      .eq("agency_id", pageId)
      .maybeSingle();
    supportUnread = Boolean((thread as { has_unread_agency?: boolean } | null)?.has_unread_agency);

    blocker = (await getPageLiveness(supabase, page.id))?.blocker ?? null;
  }

  const mobilePrimary: MobileNavItem[] = [
    { href: "/dashboard",          label: "Home",     icon: "home" },
    ...(capabilities.has("view_bookings") ? [{ href: "/dashboard/bookings", label: "Bookings", icon: "bookings" as const }] : []),
    ...(capabilities.has("manage_fleet") ? [{ href: "/dashboard/vehicles", label: "Fleet", icon: "fleet" as const }] : []),
  ];
  const mobileSecondary: MobileNavItem[] = [
    ...(capabilities.has("view_analytics") ? [{ href: "/dashboard/analytics", label: "Analytics", icon: "analytics" as const }] : []),
    ...(canSupport ? [{ href: "/dashboard/support", label: "Support", icon: "support" as const, badge: supportUnread ? "NEW" : undefined }] : []),
    { href: "/account",             label: "Account",   icon: "account" },
    { href: "/account/settings",    label: "Settings",  icon: "settings" },
    // The way out. On a phone the sidebar is hidden, so without these the
    // dashboard is a one-way door and the browser's back button is the only
    // route back to the marketplace.
    { href: "/vehicles",            label: "Browse vehicles", icon: "browse" },
    { href: "/",                    label: "DriveLink home",  icon: "home" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-slate-200 p-4 flex-col fixed h-full glass">
        <Link href="/" className="flex items-center gap-2 mb-4">
          <Image src="/logo-horizontal.png" alt="DriveLink" width={1034} height={175} unoptimized priority className="h-6 w-auto shrink-0" />
        </Link>
        {activePage && <PageSwitcher activePage={activePage} pages={pageOptions} />}
        <nav className="flex-1 flex flex-col gap-0.5">
          {NAV.filter(({ capability }) => !capability || capabilities.has(capability)).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="spring-press px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
            >
              {label}
            </Link>
          ))}
          {canSupport && <Link
            href="/dashboard/support"
            className="spring-press flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Headphones size={14} /> Support
            </span>
            {supportUnread && (
              <span className="text-xs font-semibold bg-red-500 text-slate-900 px-1.5 py-0.5 rounded-full animate-pop-in">
                NEW
              </span>
            )}
          </Link>}
        </nav>
        <div className="pt-3 border-t border-slate-200 space-y-1">
          {canManagePage && <Link
            href="/dashboard/settings"
            className="spring-press flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 rounded-lg transition-colors"
          >
            <Settings size={14} /> Page settings
          </Link>}
          <Link
            href="/account"
            className="spring-press flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 rounded-lg transition-colors"
          >
            <User size={14} /> Account
          </Link>
          <Link
            href="/account/settings"
            className="spring-press flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 rounded-lg transition-colors"
          >
            <Settings size={14} /> Settings
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content, full width on mobile, offset for sidebar on md+ */}
      <main className="flex-1 min-w-0 md:ml-56 p-4 md:p-8 pb-28 md:pb-8 pt-[calc(1rem_+_env(safe-area-inset-top))] md:pt-8 min-h-screen">
        {blocker && pageId && <PageNotLiveBanner blocker={blocker} pageId={pageId} />}
        {children}
      </main>

      <MobileNav
        primary={mobilePrimary}
        secondary={mobileSecondary}
        extra={activePage ? <PageSwitcherList activePage={activePage} pages={pageOptions} /> : undefined}
      />

      {/* Live booking-request toasts + sound + OS push, scoped to this page. */}
      {pageId && capabilities.has("view_bookings") && <BookingNotifier agencyId={pageId} viewHref="/dashboard/bookings" />}
    </div>
  );
}
