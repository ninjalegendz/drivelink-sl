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

  // Decision 9: bottom-bar slots follow page operation (owned OR staffed - 
  // PAGE-005), not a flipped role.
  let ownsPages = false;
  if (user) {
    const [{ count: owned }, { count: member }] = await Promise.all([
      supabase.from("agencies").select("id", { count: "exact", head: true })
        .eq("owner_id", user.id).is("deleted_at", null),
      supabase.from("agency_members").select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    ownsPages = (owned ?? 0) > 0 || (member ?? 0) > 0;
  }

  const primary: MobileNavItem[] =
    ownsPages
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
