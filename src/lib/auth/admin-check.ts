import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether this user is a DriveLink admin. Pass a service client: role is read
 * from profiles, and the caller has already pinned userId to the session user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isAdminUser(service: SupabaseClient<any>, userId: string): Promise<boolean> {
  const { data } = await service.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data as { role?: string } | null)?.role === "admin";
}
