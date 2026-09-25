import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell, type AdminNavItem, type AdminNavIcon } from "@/components/admin/shell/AdminShell";
import type { MobileNavItem } from "@/components/layout/MobileNav";

type NavBadge = "home" | "support";

interface NavDef {
  href: string;
  label: string;
  icon: AdminNavIcon;
  badge?: NavBadge;
}

// Calmer sidebar: Action Inbox is merged into Home, notification settings are
// in one place, and Blacklist is folded into Renters/KYC.
const NAV: NavDef[] = [
  { href: "/admin",                 label: "Home",          icon: "home",     badge: "home" },
  { href: "/admin/analytics",       label: "Analytics",     icon: "analytics" },
  { href: "/admin/vehicles",        label: "Listings",      icon: "listings" },
  { href: "/admin/bookings",        label: "All Bookings",  icon: "bookings" },
  { href: "/admin/users",           label: "Renters / KYC", icon: "users" },
  { href: "/admin/agencies",        label: "Rental Pages",  icon: "agencies" },
  { href: "/admin/reports",         label: "Reports",       icon: "reports" },
  // Every recorded action across the platform, newest first. See
  // src/app/(admin)/admin/activity/page.tsx.
  { href: "/admin/activity",        label: "Dev log",       icon: "activity" },
  { href: "/admin/support",         label: "Support",       icon: "support",  badge: "support" },
  { href: "/admin/settings",        label: "Settings",      icon: "settings" },
];

const HREF_TO_ICON: Record<string, MobileNavItem["icon"]> = {
  "/admin":                 "home",
  "/admin/analytics":       "analytics",
  "/admin/vehicles":        "listings",
  "/admin/bookings":        "all-bookings",
  "/admin/users":           "users",
  "/admin/agencies":        "agencies",
  "/admin/reports":         "cases",
  "/admin/activity":        "activity",
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

  const navItems: AdminNavItem[] = NAV.map(({ href, label, icon, badge }) => ({
    href,
    label,
    icon,
    count: badgeCount(badge) > 0 ? badgeCount(badge) : undefined,
    urgent: badge === "support",
  }));

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
    <AdminShell navItems={navItems} mobilePrimary={mobilePrimary} mobileSecondary={mobileSecondary}>
      {children}
    </AdminShell>
  );
}
