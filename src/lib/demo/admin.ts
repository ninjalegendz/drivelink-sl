import type { AdminNavItem } from "@/components/admin/shell/AdminShell";
import type { MobileNavItem } from "@/components/layout/MobileNav";
import type { AdminHomeViewProps } from "@/components/admin/shell/AdminHomeView";

// Sample data for /design/admin. Shapes mirror what the real
// src/app/(admin)/layout.tsx and src/app/(admin)/admin/page.tsx compute, so
// the preview exercises the same presentational components with plausible
// counts instead of an always-empty inbox.

export const DEMO_ADMIN_NAV: AdminNavItem[] = [
  { href: "/design/admin",           label: "Home",          icon: "home",     count: 9 },
  { href: "/design/admin/analytics", label: "Analytics",     icon: "analytics" },
  { href: "/design/admin/vehicles",  label: "Listings",      icon: "listings" },
  { href: "/design/admin/bookings",  label: "All Bookings",  icon: "bookings" },
  { href: "/design/admin/users",     label: "Renters / KYC", icon: "users" },
  { href: "/design/admin/agencies",  label: "Rental Pages",  icon: "agencies" },
  { href: "/design/admin/reports",   label: "Reports",       icon: "reports" },
  { href: "/design/admin/activity",  label: "Dev log",       icon: "activity" },
  { href: "/design/admin/support",   label: "Support",       icon: "support", count: 3, urgent: true },
  { href: "/design/admin/settings",  label: "Settings",      icon: "settings" },
];

export const DEMO_ADMIN_MOBILE_PRIMARY: MobileNavItem[] = [
  { href: "/design/admin",          label: "Home",     icon: "home", badge: 9 },
  { href: "/design/admin/vehicles", label: "Listings", icon: "listings" },
];

export const DEMO_ADMIN_MOBILE_SECONDARY: MobileNavItem[] = [
  { href: "/design/admin/analytics", label: "Analytics",     icon: "analytics" },
  { href: "/design/admin/bookings",  label: "All Bookings",  icon: "all-bookings" },
  { href: "/design/admin/users",     label: "Renters / KYC", icon: "users" },
  { href: "/design/admin/agencies",  label: "Rental Pages",  icon: "agencies" },
  { href: "/design/admin/reports",   label: "Reports",       icon: "cases" },
  { href: "/design/admin/activity",  label: "Dev log",       icon: "activity" },
  { href: "/design/admin/support",   label: "Support",       icon: "support", badge: 3 },
  { href: "/design/admin/settings",  label: "Settings",      icon: "settings" },
  { href: "/vehicles",        label: "Browse vehicles", icon: "browse" },
  { href: "/",                label: "DriveLink home",  icon: "home" },
];

export const DEMO_ADMIN_HOME: AdminHomeViewProps = {
  pendingVehiclesCount: 6,
  unreadThreadsCount: 3,
  liveVehicles: 128,
  activeBookings: 34,
  renters: 892,
  agencies: 47,
  recentBookings: [
    {
      id: "d0000000-0000-4000-8000-000000000001",
      status: "requested",
      start_date: "2026-09-26", end_date: "2026-09-29", start_time: "09:00:00", end_time: "09:00:00",
      vehicles: { make: "Toyota", model: "Corolla Hybrid", year: 2019 },
      profiles: { full_name: "Nadeesha Perera" },
    },
    {
      id: "d0000000-0000-4000-8000-000000000002",
      status: "confirmed",
      start_date: "2026-09-25", end_date: "2026-09-27", start_time: "10:00:00", end_time: "18:00:00",
      vehicles: { make: "Honda", model: "CR-V", year: 2019 },
      profiles: { full_name: "James Whitfield" },
    },
    {
      id: "d0000000-0000-4000-8000-000000000003",
      status: "active",
      start_date: "2026-09-22", end_date: "2026-09-30", start_time: "08:00:00", end_time: "08:00:00",
      vehicles: { make: "Mitsubishi", model: "Pajero", year: 2015 },
      profiles: { full_name: "Kasun Bandara" },
    },
    {
      id: "d0000000-0000-4000-8000-000000000004",
      status: "completed",
      start_date: "2026-09-18", end_date: "2026-09-20", start_time: "09:00:00", end_time: "09:00:00",
      vehicles: { make: "Tesla", model: "Model Y", year: 2023 },
      profiles: { full_name: "Amaya Fernando" },
    },
    {
      id: "d0000000-0000-4000-8000-000000000005",
      status: "cancelled",
      start_date: "2026-09-15", end_date: "2026-09-17", start_time: "09:00:00", end_time: "09:00:00",
      vehicles: { make: "Volkswagen", model: "Polo", year: 2018 },
      profiles: { full_name: "Ruwan Silva" },
    },
  ],
};
