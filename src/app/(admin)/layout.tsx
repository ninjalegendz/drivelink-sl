import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/account/SignOutButton";

const NAV = [
  { href: "/admin",            label: "Overview",      icon: "◈" },
  { href: "/admin/slips",      label: "Slip Queue",    icon: "⬆" },
  { href: "/admin/bookings",   label: "All Bookings",  icon: "📋" },
  { href: "/admin/users",      label: "Renters / KYC", icon: "👤" },
  { href: "/admin/agencies",   label: "Agencies",      icon: "🏢" },
  { href: "/admin/blacklist",  label: "Blacklist",     icon: "🚫" },
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
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link
            href="/"
            className="block px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back to site
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
