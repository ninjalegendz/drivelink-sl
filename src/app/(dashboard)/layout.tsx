import Link from "next/link";
import { Settings, User, Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/account/SignOutButton";

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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 p-4 flex flex-col fixed h-full">
        <Link href="/" className="font-bold text-lg mb-6 block">
          Drive<span className="text-amber-400">Link</span>
        </Link>
        <nav className="flex-1 flex flex-col gap-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/dashboard/support"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <Headphones size={14} /> Support
            </span>
            {supportUnread && (
              <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                NEW
              </span>
            )}
          </Link>
        </nav>
        <div className="pt-3 border-t border-slate-800 space-y-1">
          <Link
            href="/account"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <User size={14} /> Account
          </Link>
          <Link
            href="/account/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings size={14} /> Settings
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  );
}
