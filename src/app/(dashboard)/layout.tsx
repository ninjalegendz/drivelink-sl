import { redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess, type PageCapability } from "@/lib/pages/access";
import type { PageSwitcherEntry } from "@/components/dashboard/PageSwitcher";
import type { MobileNavItem } from "@/components/layout/MobileNav";
import { getPageLiveness } from "@/lib/pages/liveness";
import type { LivenessBlocker } from "@/lib/pages/liveness";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";

// Desktop sidebar order: Today first (it needs no capability), then the
// working screens in the order an owner uses them day to day.
const NAV: { href: string; label: string; icon: DashboardNavItem["icon"]; capability?: PageCapability }[] = [
  { href: "/dashboard",           label: "Today",     icon: "today" },
  { href: "/dashboard/bookings",  label: "Bookings",  icon: "bookings",  capability: "view_bookings" },
  { href: "/dashboard/vehicles",  label: "Fleet",      icon: "fleet",     capability: "manage_fleet" },
  { href: "/dashboard/analytics", label: "Analytics",  icon: "analytics", capability: "view_analytics" },
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

  const navItems: DashboardNavItem[] = [
    ...NAV.filter(({ capability }) => !capability || capabilities.has(capability))
      .map(({ href, label, icon }) => ({ href, label, icon })),
    ...(canSupport ? [{ href: "/dashboard/support", label: "Support", icon: "support" as const, badge: supportUnread ? "NEW" : undefined }] : []),
  ];

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
    <DashboardShell
      activePage={activePage}
      pageOptions={pageOptions}
      navItems={navItems}
      mobilePrimary={mobilePrimary}
      mobileSecondary={mobileSecondary}
      canManagePage={canManagePage}
      blocker={blocker}
      pageId={pageId}
      canViewBookings={capabilities.has("view_bookings")}
    >
      {children}
    </DashboardShell>
  );
}
