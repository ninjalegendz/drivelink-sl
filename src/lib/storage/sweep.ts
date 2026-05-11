import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Walks a storage bucket and deletes blobs that no profile references
 * via avatar_url / nic_url / selfie_url. Cheap to run daily — even a
 * thousand users adds up to a few hundred file lookups. The bucket
 * structure is <userId>/<filename>, so we walk one folder per profile.
 *
 * Returns count of orphaned files removed.
 */
export async function sweepOrphanStorage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  bucket: "avatars" | "kyc"
): Promise<number> {
  // Build the set of all URLs currently referenced
  const referencedFilenames = new Set<string>();
  const column = bucket === "avatars" ? "avatar_url" : null;

  if (column) {
    const { data: rows } = await service.from("profiles").select(column).not(column, "is", null);
    for (const r of (rows ?? []) as Record<string, string | null>[]) {
      const url = r[column];
      if (url) referencedFilenames.add(filenameFromUrl(url, bucket));
    }
  } else {
    // kyc bucket: nic_url + selfie_url
    const { data: rows } = await service
      .from("profiles")
      .select("nic_url, selfie_url")
      .or("nic_url.not.is.null,selfie_url.not.is.null");
    for (const r of (rows ?? []) as { nic_url: string | null; selfie_url: string | null }[]) {
      if (r.nic_url)    referencedFilenames.add(filenameFromUrl(r.nic_url,    bucket));
      if (r.selfie_url) referencedFilenames.add(filenameFromUrl(r.selfie_url, bucket));
    }
  }

  // List all user-folders in the bucket
  const { data: folders, error: listError } = await service.storage.from(bucket).list("", { limit: 1000 });
  if (listError || !folders) return 0;

  const orphanPaths: string[] = [];
  for (const folder of folders) {
    // folder.name = userId (e.g. "8c39e4a7-...")
    const { data: files } = await service.storage.from(bucket).list(folder.name, { limit: 1000 });
    for (const f of files ?? []) {
      const fullPath = `${folder.name}/${f.name}`;
      if (!referencedFilenames.has(fullPath)) orphanPaths.push(fullPath);
    }
  }

  if (orphanPaths.length === 0) return 0;

  // Delete in batches to avoid request-size limits
  const BATCH = 100;
  for (let i = 0; i < orphanPaths.length; i += BATCH) {
    const batch = orphanPaths.slice(i, i + BATCH);
    await service.storage.from(bucket).remove(batch);
  }
  return orphanPaths.length;
}

// Pull "<userId>/<file>" out of a public Supabase storage URL
function filenameFromUrl(url: string, bucket: string): string {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return "";
  return url.slice(idx + marker.length);
}
