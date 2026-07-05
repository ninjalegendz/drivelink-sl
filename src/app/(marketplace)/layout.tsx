import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  // Tailor bottom-nav primary slots to who's looking. Home / Pricing / FAQ /
  // Sign in / Account all live in the top-header burger menu now, the
  // bottom bar keeps just the two highest-frequency actions and only shows
  // inside the Capacitor-wrapped app (see MobileNav `requireApp`).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (data as { role?: string } | null)?.role ?? null;
  }

  const primary: MobileNavItem[] =
    role === "agency_owner"
      ? [
          { href: "/vehicles",  label: "Browse",    icon: "browse" },
          { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        ]
      : [
          { href: "/vehicles", label: "Browse",   icon: "browse" },
          { href: "/bookings", label: "Bookings", icon: "bookings" },
        ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-24 md:pb-0">{children}</main>
      <Footer />
      <MobileNav primary={primary} requireApp />
    </>
  );
}
