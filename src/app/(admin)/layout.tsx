import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ReceiptText, ClipboardList, Users, Building2, Ban, Settings, Car, Mail, Headphones, Receipt, Landmark, BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/account/SignOutButton";

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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-slate-800 flex flex-col fixed h-full">
        <div className="p-4 border-b border-slate-800">
          <Link href="/" className="font-bold text-lg">
            Drive<span className="text-amber-400">Link</span>
          </Link>
          <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium ring-1 ring-red-500/30">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ href, label, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <Icon size={16} className="shrink-0" />
                {label}
              </span>
              {badge === "support" && supportUnread && supportUnread > 0 && (
                <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {supportUnread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link
            href="/account/settings"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Settings size={16} className="shrink-0" /> Settings
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-52 p-8 max-w-full">{children}</main>
    </div>
  );
}
