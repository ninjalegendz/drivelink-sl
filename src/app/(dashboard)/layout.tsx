import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Settings, User, Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { SignOutButton } from "@/components/account/SignOutButton";
import { PageSwitcher, type PageSwitcherEntry } from "@/components/dashboard/PageSwitcher";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import { BookingNotifier } from "@/components/realtime/BookingNotifier";

const NAV = [
  { href: "/dashboard",           label: "Overview" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/vehicles",  label: "Fleet" },
  { href: "/dashboard/bookings",  label: "Bookings" },
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

  if (user) {
    const { page, pages } = await getActivePage(supabase, user.id);
    if (!page) redirect("/account/pages/new");

    pageId = page.id;
    activePage = { id: page.id, name: page.name, page_type: page.page_type, logo_url: page.logo_url };
    pageOptions = pages.map((p) => ({ id: p.id, name: p.name, page_type: p.page_type, logo_url: p.logo_url }));

    const { data: thread } = await supabase
      .from("support_threads")
      .select("has_unread_agency")
      .eq("agency_id", pageId)
      .maybeSingle();
    supportUnread = Boolean((thread as { has_unread_agency?: boolean } | null)?.has_unread_agency);
  }

  const mobilePrimary: MobileNavItem[] = [
    { href: "/dashboard",          label: "Home",     icon: "home" },
    { href: "/dashboard/bookings", label: "Bookings", icon: "bookings" },
    { href: "/dashboard/vehicles", label: "Fleet",    icon: "fleet" },
  ];
  const mobileSecondary: MobileNavItem[] = [
    { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
    { href: "/dashboard/support",   label: "Support",   icon: "support", badge: supportUnread ? "NEW" : undefined },
    { href: "/account",             label: "Account",   icon: "account" },
    { href: "/account/settings",    label: "Settings",  icon: "settings" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-slate-200 p-4 flex-col fixed h-full glass">
        <Link href="/" className="flex items-center gap-2 mb-4">
          <Image src="/logo-circle.png" alt="DriveLink logo" width={28} height={28} unoptimized className="h-7 w-7 shrink-0" />
          <span className="font-bold text-lg">Drive<span className="text-blue-600">Link</span></span>
        </Link>
        {activePage && <PageSwitcher activePage={activePage} pages={pageOptions} />}
        <nav className="flex-1 flex flex-col gap-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="spring-press px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/dashboard/support"
            className="spring-press flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Headphones size={14} /> Support
            </span>
            {supportUnread && (
              <span className="text-[10px] font-semibold bg-red-500 text-slate-900 px-1.5 py-0.5 rounded-full animate-pop-in">
                NEW
              </span>
            )}
          </Link>
        </nav>
        <div className="pt-3 border-t border-slate-200 space-y-1">
          <Link
            href="/dashboard/settings"
            className="spring-press flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 rounded-lg transition-colors"
          >
            <Settings size={14} /> Page settings
          </Link>
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
      <main className="flex-1 min-w-0 md:ml-56 p-4 md:p-8 pb-24 md:pb-8 min-h-screen">
        {activePage && (
          <div className="md:hidden mb-4">
            <PageSwitcher activePage={activePage} pages={pageOptions} />
          </div>
        )}
        {children}
      </main>

      <MobileNav primary={mobilePrimary} secondary={mobileSecondary} />

      {/* Live booking-request toasts + sound + OS push, scoped to this page. */}
      {pageId && <BookingNotifier agencyId={pageId} viewHref="/dashboard/bookings" />}
    </div>
  );
}
