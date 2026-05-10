import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the support thread for an agency, creating one on first use.
 * Pass an authed-as-agency-owner client OR a service client; both can
 * upsert into support_threads.
 */
export async function getOrCreateThreadForAgency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  agencyId: string
): Promise<{ id: string } | null> {
  const { data: existing } = await supabase
    .from("support_threads")
    .select("id")
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (existing) return existing as { id: string };

  const { data: created, error } = await supabase
    .from("support_threads")
    .insert({ agency_id: agencyId })
    .select("id")
    .single();
  if (error) {
    // Race on the unique constraint — another tab created it. Re-read.
    const { data: refetched } = await supabase
      .from("support_threads")
      .select("id")
      .eq("agency_id", agencyId)
      .maybeSingle();
    return (refetched as { id: string } | null) ?? null;
  }
  return created as { id: string };
}
