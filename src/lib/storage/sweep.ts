import type { SupabaseClient } from "@supabase/supabase-js";
import { listPrefix, deleteObjects, extractKeyFromUrl } from "./r2";

/**
 * Walks an R2 prefix and deletes blobs that no profile references via
 * avatar_url / nic_url / selfie_url. Cheap to run daily — even a thousand
 * users adds up to a few hundred file lookups.
 *
 * The key layout is `<prefix>/<userId>/<uuid>.<ext>`. We list every key
 * under the prefix and remove any that aren't pointed at by a row.
 *
 * Returns count of orphaned files removed.
 */
export async function sweepOrphanStorage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  prefix: "avatars" | "kyc"
): Promise<number> {
  // Build the set of all R2 keys currently referenced by a row
  const referencedKeys = new Set<string>();

  if (prefix === "avatars") {
    const { data: rows } = await service.from("profiles").select("avatar_url").not("avatar_url", "is", null);
    for (const r of (rows ?? []) as { avatar_url: string | null }[]) {
      const key = extractKeyFromUrl(r.avatar_url);
      if (key) referencedKeys.add(key);
    }
  } else {
    // kyc prefix: nic_url + selfie_url
    const { data: rows } = await service
      .from("profiles")
      .select("nic_url, selfie_url")
      .or("nic_url.not.is.null,selfie_url.not.is.null");
    for (const r of (rows ?? []) as { nic_url: string | null; selfie_url: string | null }[]) {
      const nicKey    = extractKeyFromUrl(r.nic_url);
      const selfieKey = extractKeyFromUrl(r.selfie_url);
      if (nicKey)    referencedKeys.add(nicKey);
      if (selfieKey) referencedKeys.add(selfieKey);
    }
  }

  // List every object under the prefix and pick the orphans
  const allKeys = await listPrefix(prefix);
  const orphanKeys = allKeys.filter((k) => !referencedKeys.has(k));

  if (orphanKeys.length === 0) return 0;

  await deleteObjects(orphanKeys);
  return orphanKeys.length;
}
