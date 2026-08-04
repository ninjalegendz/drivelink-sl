import type { SupabaseClient } from "@supabase/supabase-js";
import { listPrefix, deleteObjects, extractKeyFromUrl } from "./r2";

/**
 * Walks an R2 prefix and deletes blobs that no profile references. For the
 * `kyc` prefix that means avatar_url / nic_url / selfie_url AND the two
 * driving-licence columns (license_front_url / license_back_url) — licences
 * are stored under the same `kyc` prefix (see LicenseUploadForm), so leaving
 * them out of the referenced set would mark every valid licence image as an
 * orphan and delete it on the next run. Cheap to run daily, even a thousand
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
    // kyc prefix: nic_url + selfie_url + both driving-licence images. ALL of
    // these live under `kyc/`; every column that can point here must be
    // treated as a live reference or the sweep will delete valid documents.
    const { data: rows } = await service
      .from("profiles")
      .select("nic_url, selfie_url, license_front_url, license_back_url")
      .or(
        "nic_url.not.is.null,selfie_url.not.is.null," +
        "license_front_url.not.is.null,license_back_url.not.is.null"
      );
    for (const r of (rows ?? []) as {
      nic_url: string | null;
      selfie_url: string | null;
      license_front_url: string | null;
      license_back_url: string | null;
    }[]) {
      for (const url of [r.nic_url, r.selfie_url, r.license_front_url, r.license_back_url]) {
        const key = extractKeyFromUrl(url);
        if (key) referencedKeys.add(key);
      }
    }
  }

  // List every object under the prefix and pick the orphans
  const allKeys = await listPrefix(prefix);
  const orphanKeys = allKeys.filter((k) => !referencedKeys.has(k));

  if (orphanKeys.length === 0) return 0;

  await deleteObjects(orphanKeys);
  return orphanKeys.length;
}
