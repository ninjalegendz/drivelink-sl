import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBurger } from "./NavBurger";

type NavRole = "admin" | "agency_owner" | "renter" | null;

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: NavRole = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const raw = (data as { role?: string } | null)?.role;
    role = raw === "admin" || raw === "agency_owner" || raw === "renter" ? raw : null;
  }

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-white text-lg tracking-tight">
          Drive<span className="text-amber-400">Link</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/vehicles" className="hover:text-white transition-colors">Browse</Link>
          <Link href="/pricing"  className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/faq"      className="hover:text-white transition-colors">FAQ</Link>
          {!user && (
            <Link href="/signup/agency" className="hover:text-white transition-colors">
              List your fleet
            </Link>
          )}
        </nav>

        {/* Desktop right-side auth actions */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            role === "admin" ? (
              <Link
                href="/admin"
                className="px-4 py-1.5 text-sm bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold rounded-xl transition-colors border border-red-500/25"
              >
                Admin
              </Link>
            ) : role === "agency_owner" ? (
              <Link
                href="/dashboard"
                className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/account"
                className="px-4 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
              >
                Account
              </Link>
            )
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup/agency"
                className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl transition-colors"
              >
                List your fleet
              </Link>
            </>
          )}
        </div>

        {/* Mobile burger replaces the entire mid-nav + right-side actions */}
        <NavBurger role={role} />
      </div>
    </header>
  );
}
