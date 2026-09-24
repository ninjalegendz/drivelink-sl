import { createClient } from "@/lib/supabase/server";
import { NavbarShell } from "./NavbarShell";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Decision 9: one identity does both. Admin is a distinct role, but everyone
  // else is simply an account holder who can ALSO own Rental Pages - so owner
  // navigation is derived from page ownership, not a role that flips a renter
  // into "agency_owner" and hides their personal screens.
  let isAdmin  = false;
  let ownsPages = false;
  let name: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    // "Owns pages" now means "can operate a page" - owned OR staffed (PAGE-005),
    // so staff members get the same dashboard entry point as owners.
    const [{ data: prof }, { count: owned }, { count: member }] = await Promise.all([
      supabase.from("profiles").select("role, full_name, avatar_url").eq("id", user.id).single(),
      supabase.from("agencies").select("id", { count: "exact", head: true })
        .eq("owner_id", user.id).is("deleted_at", null),
      supabase.from("agency_members").select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    const profile = prof as { role?: string; full_name?: string | null; avatar_url?: string | null } | null;
    isAdmin   = profile?.role === "admin";
    ownsPages = (owned ?? 0) > 0 || (member ?? 0) > 0;
    name      = profile?.full_name?.trim() || user.email || null;
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <NavbarShell
      isAdmin={isAdmin}
      ownsPages={ownsPages}
      signedIn={!!user}
      name={name}
      avatarUrl={avatarUrl}
    />
  );
}
