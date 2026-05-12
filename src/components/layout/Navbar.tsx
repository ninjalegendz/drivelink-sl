import { createClient } from "@/lib/supabase/server";
import { NavbarShell } from "./NavbarShell";

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

  return <NavbarShell role={role} signedIn={!!user} />;
}
