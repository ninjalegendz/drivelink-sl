import { createClient } from "@/lib/supabase/server";

// Shared admin gate for API routes. Uses the cookie-bound client so it respects
// the caller's session; checks the profile role.
export async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; status: 401 | 403 }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, status: 403 };
  }
  return { ok: true, userId: user.id };
}
