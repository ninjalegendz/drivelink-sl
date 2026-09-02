import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  // The mobile bar is deliberately available on the web and native wrapper.
  // A phone browser is the main product surface, so high-frequency actions
  // cannot be hidden behind the header menu.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Decision 9: bottom-bar slots follow page operation (owned OR staffed - 
  // PAGE-005), not a flipped role.
  let ownsPages = false;
  let isAdmin = false;
  if (user) {
    const [{ count: owned }, { count: member }] = await Promise.all([
      supabase.from("agencies").select("id", { count: "exact", head: true })
        .eq("owner_id", user.id).is("deleted_at", null),
      supabase.from("agency_members").select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    ownsPages = (owned ?? 0) > 0 || (member ?? 0) > 0;

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    isAdmin = (profile as { role?: string } | null)?.role === "admin";
  }

  const primary: MobileNavItem[] = !user
    ? [
        { href: "/vehicles", label: "Browse", icon: "browse" },
        { href: "/academy", label: "Guides", icon: "guides" },
        { href: "/login", label: "Log in", icon: "signin" },
      ]
    : ownsPages
      ? [
          { href: "/vehicles", label: "Browse", icon: "browse" },
          { href: "/dashboard", label: "Page", icon: "dashboard" },
          { href: "/account", label: "You", icon: "account" },
        ]
      : [
          { href: "/vehicles", label: "Browse", icon: "browse" },
          { href: "/bookings", label: "Bookings", icon: "bookings" },
          { href: "/account", label: "You", icon: "account" },
        ];

  // Everything the header's mobile menu used to hold now lives here, because
  // two menus on one screen doing the same job is just a decision the reader
  // has to make twice. Airport transfers and "List your vehicle" in particular
  // had no other route on a phone once that menu went.
  const secondary: MobileNavItem[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/vehicles?option=airport-pickup", label: "Airport transfers", icon: "car" },
    { href: "/pricing", label: "Pricing", icon: "pricing" },
    { href: "/academy", label: "Guides", icon: "guides" },
    ...(ownsPages
      ? []
      : [{ href: user ? "/account/pages/new" : "/signup?intent=provider", label: "List your vehicle", icon: "dashboard" as const }]),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "users" as const }] : []),
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-24 md:pb-0">{children}</main>
      <Footer />
      <MobileNav primary={primary} secondary={secondary} />
    </>
  );
}
