import Link from "next/link";
import { Settings, User, Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/account/SignOutButton";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";

const NAV = [
  { href: "/dashboard",           label: "Overview" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/vehicles",  label: "Fleet" },
  { href: "/dashboard/bookings",  label: "Bookings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Surface a "new reply" indicator on the Support link so the agency owner
  // knows when admin has responded without having to open the page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let supportUnread = false;
  if (user) {
    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (agency) {
      const { data: thread } = await supabase
        .from("support_threads")
        .select("has_unread_agency")
        .eq("agency_id", (agency as { id: string }).id)
        .maybeSingle();
      supportUnread = Boolean((thread as { has_unread_agency?: boolean } | null)?.has_unread_agency);
    }
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
      <aside className="hidden md:flex w-56 shrink-0 border-r border-slate-700 p-4 flex-col fixed h-full glass">
        <Link href="/" className="font-bold text-lg mb-6 block">
          Drive<span className="text-amber-500">Link</span>
        </Link>
        <nav className="flex-1 flex flex-col gap-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="spring-press px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-200 hover:bg-white/60 transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/dashboard/support"
            className="spring-press flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-200 hover:bg-white/60 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Headphones size={14} /> Support
            </span>
            {supportUnread && (
              <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pop-in">
                NEW
              </span>
            )}
          </Link>
        </nav>
        <div className="pt-3 border-t border-slate-700 space-y-1">
          <Link
            href="/account"
            className="spring-press flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-200 hover:bg-white/60 rounded-lg transition-colors"
          >
            <User size={14} /> Account
          </Link>
          <Link
            href="/account/settings"
            className="spring-press flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-200 hover:bg-white/60 rounded-lg transition-colors"
          >
            <Settings size={14} /> Settings
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content — full width on mobile, offset for sidebar on md+ */}
      <main className="flex-1 md:ml-56 p-4 md:p-8 pb-24 md:pb-8 min-h-screen">{children}</main>

      <MobileNav primary={mobilePrimary} secondary={mobileSecondary} />
    </div>
  );
}
