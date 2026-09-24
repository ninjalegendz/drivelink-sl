import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, ClipboardList, Users, Building2, Settings, Car,
  Headphones, BarChart3, UserCog, Flag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/account/SignOutButton";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import { BookingNotifier } from "@/components/realtime/BookingNotifier";

type NavBadge = "home" | "support";

interface AdminNavItem {
  href:    string;
  label:   string;
  Icon:    React.ComponentType<{ size?: number; className?: string }>;
  badge?:  NavBadge;
}

// Calmer sidebar: Action Inbox is merged into Home, notification settings are
// in one place, and Blacklist is folded into Renters/KYC.
const NAV: AdminNavItem[] = [
  { href: "/admin",                 label: "Home",          Icon: LayoutDashboard, badge: "home" },
  { href: "/admin/analytics",       label: "Analytics",     Icon: BarChart3 },
  { href: "/admin/vehicles",        label: "Listings",      Icon: Car },
  { href: "/admin/bookings",        label: "All Bookings",  Icon: ClipboardList },
  { href: "/admin/users",           label: "Renters / KYC", Icon: Users },
  { href: "/admin/agencies",        label: "Rental Pages",  Icon: Building2 },
  { href: "/admin/reports",         label: "Reports",       Icon: Flag },
  { href: "/admin/support",         label: "Support",       Icon: Headphones, badge: "support" },
  { href: "/admin/settings",        label: "Settings",      Icon: Settings },
];

const HREF_TO_ICON: Record<string, MobileNavItem["icon"]> = {
  "/admin":                 "home",
  "/admin/analytics":       "analytics",
  "/admin/vehicles":        "listings",
  "/admin/bookings":        "all-bookings",
  "/admin/users":           "users",
  "/admin/agencies":        "agencies",
  "/admin/support":         "support",
  "/admin/settings":        "settings",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/");

  // Badge counts for the two admin areas that need immediate attention.
  const [
    { count: supportUnread },
    { count: pendingVehicles },
  ] = await Promise.all([
    supabase.from("support_threads").select("*", { count: "exact", head: true }).eq("has_unread_admin", true),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
  ]);

  const inboxTotal = (pendingVehicles ?? 0) + (supportUnread ?? 0);

  function badgeCount(b?: NavBadge): number {
    if (b === "home")     return inboxTotal;
    if (b === "support")  return supportUnread ?? 0;
    return 0;
  }

  // Bottom bar on mobile: 3 most-touched pages + the rest in the "More" sheet.
  const mobilePrimary: MobileNavItem[] = [
    { href: "/admin",          label: "Home",     icon: "home", badge: inboxTotal > 0 ? inboxTotal : undefined },
    { href: "/admin/vehicles", label: "Listings", icon: "listings" },
  ];
  const primaryHrefs = mobilePrimary.map((p) => p.href);
  const mobileSecondary: MobileNavItem[] = NAV
    .filter((item) => !primaryHrefs.includes(item.href))
    .map((item) => ({
      href:  item.href,
      label: item.label,
      icon:  HREF_TO_ICON[item.href] ?? "home",
      badge: badgeCount(item.badge) > 0 ? badgeCount(item.badge) : undefined,
    }));
  // Same one-way door as the dashboard: the desktop sidebar is hidden on a
  // phone, so the marketplace needs a route out of here.
  mobileSecondary.push(
    { href: "/vehicles", label: "Browse vehicles", icon: "browse" },
    { href: "/",         label: "DriveLink home",  icon: "home" },
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-slate-200 flex-col fixed h-full glass">
        <div className="p-4 border-b border-slate-200">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg align-middle">
            <Image src="/logo-horizontal.png" alt="DriveLink" width={1034} height={175} unoptimized priority className="h-6 w-auto shrink-0" />
          </Link>
          <span className="ml-2 text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-medium ring-1 ring-rose-200">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, Icon, badge }) => {
            const count = badgeCount(badge);
            return (
              <Link
                key={href}
                href={href}
                className="spring-press flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon size={16} className="shrink-0" />
                  {label}
                </span>
                {count > 0 && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full animate-pop-in ${
                    badge === "support" ? "bg-red-500 text-white" : "bg-blue-600 text-white"
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200 space-y-1">
          <Link
            href="/account/settings"
            className="spring-press flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/60 transition-colors"
          >
            <UserCog size={16} className="shrink-0" /> My account
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 md:ml-52 p-4 md:p-8 pb-28 md:pb-8 pt-[calc(1rem_+_env(safe-area-inset-top))] md:pt-8 max-w-full min-h-screen">{children}</main>

      <MobileNav primary={mobilePrimary} secondary={mobileSecondary} />

      {/* Admins see every new booking land in real-time. No agencyId = no filter. */}
      <BookingNotifier viewHref="/admin/bookings" />
    </div>
  );
}
