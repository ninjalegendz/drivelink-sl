import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ReceiptText, ClipboardList, Users, Building2, Ban, Settings, Car, Mail, Headphones, Receipt, Landmark, BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/account/SignOutButton";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";

const NAV = [
  { href: "/admin",                 label: "Overview",      Icon: LayoutDashboard },
  { href: "/admin/analytics",       label: "Analytics",     Icon: BarChart3 },
  { href: "/admin/slips",           label: "Slip Queue",    Icon: ReceiptText },
  { href: "/admin/vehicles",        label: "Listings",      Icon: Car },
  { href: "/admin/bookings",        label: "All Bookings",  Icon: ClipboardList },
  { href: "/admin/users",           label: "Renters / KYC", Icon: Users },
  { href: "/admin/agencies",        label: "Agencies",      Icon: Building2 },
  { href: "/admin/blacklist",       label: "Blacklist",     Icon: Ban },
  { href: "/admin/support",         label: "Support",       Icon: Headphones, badge: "support" as const },
  { href: "/admin/invoices",          label: "Invoices",     Icon: Receipt },
  { href: "/admin/settings/payments", label: "Bank account", Icon: Landmark },
  { href: "/admin/settings/email",    label: "Email setup",  Icon: Mail },
];

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

  // Count threads with admin-side unread for the sidebar badge
  const { count: supportUnread } = await supabase
    .from("support_threads")
    .select("*", { count: "exact", head: true })
    .eq("has_unread_admin", true);

  // Bottom nav: 3 most-touched admin pages + spillover sheet for the rest
  const mobilePrimary: MobileNavItem[] = [
    { href: "/admin",          label: "Home",     icon: "home" },
    { href: "/admin/bookings", label: "Bookings", icon: "all-bookings" },
    { href: "/admin/slips",    label: "Slips",    icon: "slips" },
  ];
  // Map each NAV href to its MobileNav icon name. Keep this aligned with
  // the NAV array; if you add a sidebar entry, add it here too.
  const HREF_TO_ICON: Record<string, MobileNavItem["icon"]> = {
    "/admin":                 "home",
    "/admin/analytics":       "analytics",
    "/admin/slips":           "slips",
    "/admin/vehicles":        "listings",
    "/admin/bookings":        "all-bookings",
    "/admin/users":           "users",
    "/admin/agencies":        "agencies",
    "/admin/blacklist":       "blacklist",
    "/admin/support":         "support",
    "/admin/invoices":        "invoices",
    "/admin/settings/payments": "bank",
    "/admin/settings/email":  "email",
  };
  const mobileSecondary: MobileNavItem[] = NAV.filter((item) =>
    !["/admin", "/admin/bookings", "/admin/slips"].includes(item.href)
  ).map((item) => ({
    href:  item.href,
    label: item.label,
    icon:  HREF_TO_ICON[item.href] ?? "home",
    badge: item.badge === "support" && supportUnread && supportUnread > 0 ? supportUnread : undefined,
  }));

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-slate-700 flex-col fixed h-full glass">
        <div className="p-4 border-b border-slate-700">
          <Link href="/" className="font-bold text-lg">
            Drive<span className="text-amber-500">Link</span>
          </Link>
          <span className="ml-2 text-xs bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full font-medium ring-1 ring-red-500/25">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className="spring-press flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-200 hover:bg-white/60 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <Icon size={16} className="shrink-0" />
                {label}
              </span>
              {badge === "support" && supportUnread && supportUnread > 0 && (
                <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pop-in">
                  {supportUnread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700 space-y-1">
          <Link
            href="/account/settings"
            className="spring-press flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-200 hover:bg-white/60 transition-colors"
          >
            <Settings size={16} className="shrink-0" /> Settings
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 md:ml-52 p-4 md:p-8 pb-24 md:pb-8 max-w-full min-h-screen">{children}</main>

      <MobileNav primary={mobilePrimary} secondary={mobileSecondary} />
    </div>
  );
}
