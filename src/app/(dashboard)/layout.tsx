import Link from "next/link";
import { SignOutButton } from "@/components/account/SignOutButton";

const NAV = [
  { href: "/dashboard",          label: "Overview" },
  { href: "/dashboard/vehicles", label: "Fleet" },
  { href: "/dashboard/bookings", label: "Bookings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
        </nav>
        <div className="pt-3 border-t border-slate-800 space-y-1">
          <Link href="/" className="block px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to site
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
