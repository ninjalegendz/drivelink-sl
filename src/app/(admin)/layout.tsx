import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, ReceiptText, ClipboardList, Users, Building2, Settings, Car,
  Headphones, Receipt, BarChart3, UserCog,
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
  feeOnly?: boolean; // only shown once a booking fee is configured (> 0)
}

// Calmer sidebar: Action Inbox merged into Home; the 3 settings pages merged
// into one Settings; Blacklist folded into Renters/KYC; Slip Queue + Invoices
// only appear once monetization is on (booking_fee_lkr > 0).
const NAV: AdminNavItem[] = [
  { href: "/admin",                 label: "Home",          Icon: LayoutDashboard, badge: "home" },
  { href: "/admin/analytics",       label: "Analytics",     Icon: BarChart3 },
  { href: "/admin/vehicles",        label: "Listings",      Icon: Car },
  { href: "/admin/bookings",        label: "All Bookings",  Icon: ClipboardList },
  { href: "/admin/slips",           label: "Slip Queue",    Icon: ReceiptText, feeOnly: true },
  { href: "/admin/invoices",        label: "Invoices",      Icon: Receipt, feeOnly: true },
  { href: "/admin/users",           label: "Renters / KYC", Icon: Users },
  { href: "/admin/agencies",        label: "Agencies",      Icon: Building2 },
  { href: "/admin/support",         label: "Support",       Icon: Headphones, badge: "support" },
  { href: "/admin/settings",        label: "Settings",      Icon: Settings },
];

const HREF_TO_ICON: Record<string, MobileNavItem["icon"]> = {
  "/admin":                 "home",
  "/admin/analytics":       "analytics",
  "/admin/vehicles":        "listings",
  "/admin/bookings":        "all-bookings",
  "/admin/slips":           "slips",
  "/admin/invoices":        "invoices",
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

  // Badge counts + monetization flag, in one round-trip.
  const [
    { count: supportUnread },
    { count: pendingVehicles },
    { data: settingsRow },
  ] = await Promise.all([
    supabase.from("support_threads").select("*", { count: "exact", head: true }).eq("has_unread_admin", true),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("platform_settings").select("booking_fee_lkr").eq("id", true).single(),
  ]);

  const inboxTotal = (pendingVehicles ?? 0) + (supportUnread ?? 0);
  const feeEnabled = (((settingsRow as { booking_fee_lkr?: number } | null)?.booking_fee_lkr) ?? 0) > 0;

  const visibleNav = NAV.filter((item) => !item.feeOnly || feeEnabled);

  function badgeCount(b?: NavBadge): number {
    if (b === "home")     return inboxTotal;
    if (b === "support")  return supportUnread ?? 0;
    return 0;
  }

  // Bottom bar on mobile: 3 most-touched pages + the rest in the "More" sheet.
  const mobilePrimary: MobileNavItem[] = [
    { href: "/admin",          label: "Home",     icon: "home", badge: inboxTotal > 0 ? inboxTotal : undefined },
    { href: "/admin/bookings", label: "Bookings", icon: "all-bookings" },
    { href: "/admin/vehicles", label: "Listings", icon: "listings" },
  ];
  const primaryHrefs = mobilePrimary.map((p) => p.href);
  const mobileSecondary: MobileNavItem[] = visibleNav
    .filter((item) => !primaryHrefs.includes(item.href))
    .map((item) => ({
      href:  item.href,
      label: item.label,
      icon:  HREF_TO_ICON[item.href] ?? "home",
      badge: badgeCount(item.badge) > 0 ? badgeCount(item.badge) : undefined,
    }));

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-slate-200 flex-col fixed h-full glass">
        <div className="p-4 border-b border-slate-200">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg align-middle">
            <Image src="/logo-circle.png" alt="DriveLink logo" width={26} height={26} unoptimized className="h-[26px] w-[26px] shrink-0" />
            <span>Drive<span className="text-blue-600">Link</span></span>
          </Link>
          <span className="ml-2 text-xs bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full font-medium ring-1 ring-red-500/25">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, label, Icon, badge }) => {
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
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full animate-pop-in ${
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
      <main className="flex-1 min-w-0 md:ml-52 p-4 md:p-8 pb-24 md:pb-8 max-w-full min-h-screen">{children}</main>

      <MobileNav primary={mobilePrimary} secondary={mobileSecondary} />

      {/* Admins see every new booking land in real-time. No agencyId = no filter. */}
      <BookingNotifier viewHref="/admin/bookings" />
    </div>
  );
}
