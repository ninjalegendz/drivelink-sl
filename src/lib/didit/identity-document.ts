import type { SupabaseClient } from "@supabase/supabase-js";
import { detectedContentType, validateUploadedBytes } from "@/lib/storage/upload-validation";
import { displayKeyFor, getDocUrl, previewKeyFor, putObject } from "@/lib/storage/r2";
import { renderDisplayCopy, renderDocumentPreview } from "@/lib/storage/watermark";

type JsonRecord = Record<string, unknown>;

export interface DiditIdentityDocument {
  documentType: string | null;
  frontUrl: string | null;
  backUrl: string | null;
}

function recordsFrom(value: unknown): JsonRecord[] {
  if (!value || typeof value !== "object") return [];
  const record = value as JsonRecord;
  const plural = Array.isArray(record.id_verifications)
    ? record.id_verifications.filter((item): item is JsonRecord => Boolean(item && typeof item === "object"))
    : [];
  const singular = record.id_verification && typeof record.id_verification === "object"
    ? [record.id_verification as JsonRecord]
    : [];
  return [...plural, ...singular];
}

export function extractDiditIdentityDocument(payload: JsonRecord): DiditIdentityDocument | null {
  const candidates = [
    ...recordsFrom(payload),
    ...recordsFrom(payload.decision),
    ...recordsFrom(payload.data),
    ...recordsFrom((payload.data as JsonRecord | undefined)?.decision),
  ];
  if (candidates.length === 0) return null;

  const record = candidates.find((candidate) => String(candidate.status ?? "").toLowerCase() === "approved")
    ?? candidates[0];
  const stringValue = (...values: unknown[]) => {
    const value = values.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return typeof value === "string" ? value.trim() : null;
  };

  return {
    documentType: stringValue(record.document_type, record.document_subtype),
    frontUrl: stringValue(record.full_front_image, record.front_image),
    backUrl: stringValue(record.full_back_image, record.back_image),
  };
}

function isApprovedDiditMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return url.hostname.endsWith(".didit.me")
      || url.hostname === "service-didit-verification-production-a1c5f9b8.s3.amazonaws.com";
  } catch {
    return false;
  }
}

async function downloadIdentityImage(url: string): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
  if (!isApprovedDiditMediaUrl(url)) throw new Error("Didit returned an unexpected document host.");
  const response = await fetch(url, { redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error(`Didit document download failed (${response.status}).`);
  const announcedLength = Number(response.headers.get("content-length") ?? "0");
  if (announcedLength > 5 * 1024 * 1024) throw new Error("Didit document is larger than the private upload limit.");

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = detectedContentType(bytes);
  if (!actual) throw new Error("Didit document is not a supported image.");
  const validated = validateUploadedBytes("kyc", bytes, actual);
  if (!validated.ok) throw new Error(validated.reason);
  return {
    bytes,
    contentType: validated.contentType,
    extension: validated.contentType === "image/jpeg" ? "jpg" : "png",
  };
}

/**
 * Build both derivatives while we still hold the bytes, so the original is
 * decoded exactly once for its whole life. Without this the first admin page
 * load after a sync would render every freshly imported document at once,
 * which is the burst that used to overload the worker. Best effort: a failure
 * here only means the derivatives get built on first view instead.
 */
async function storeDerivatives(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  try {
    const display = renderDisplayCopy(bytes, contentType);
    if (!display) return;
    await putObject(displayKeyFor(key), display.bytes, display.contentType, { source: "didit", kind: "display" });

    // Built from the display copy, not the original, to avoid a second decode
    // of the full-resolution image inside the same request.
    const preview = renderDocumentPreview(display.bytes, display.contentType);
    if (!preview) return;
    await putObject(previewKeyFor(key), preview.bytes, preview.contentType, { source: "didit", kind: "preview" });
  } catch (error) {
    console.error("[didit identity] derivative build failed", error instanceof Error ? error.message : error);
  }
}

export async function importDiditIdentityDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  input: { userId: string; sessionId: string; payload: JsonRecord },
): Promise<{ imported: boolean; front: boolean; back: boolean }> {
  if (!/^[0-9a-f-]{30,40}$/i.test(input.sessionId)) throw new Error("Invalid Didit session id.");
  const document = extractDiditIdentityDocument(input.payload);
  if (!document?.frontUrl) return { imported: false, front: false, back: false };

  const [front, back] = await Promise.all([
    downloadIdentityImage(document.frontUrl),
    document.backUrl ? downloadIdentityImage(document.backUrl) : Promise.resolve(null),
  ]);
  const base = `kyc/${input.userId}/didit-${input.sessionId}`;
  const frontKey = `${base}-front.${front.extension}`;
  const backKey = back ? `${base}-back.${back.extension}` : null;

  await putObject(frontKey, front.bytes, front.contentType, {
    source: "didit",
    side: "front",
    session: input.sessionId,
  });
  if (back && backKey) {
    await putObject(backKey, back.bytes, back.contentType, {
      source: "didit",
      side: "back",
      session: input.sessionId,
    });
  }

  // Sequential, not parallel: each render holds a full pixel buffer and the
  // isolate's memory ceiling is shared with every other in-flight request.
  await storeDerivatives(frontKey, front.bytes, front.contentType);
  if (back && backKey) await storeDerivatives(backKey, back.bytes, back.contentType);

  const { data, error } = await service
    .from("profiles")
    .update({
      nic_url: getDocUrl(frontKey),
      identity_back_url: backKey ? getDocUrl(backKey) : null,
      identity_document_type: document.documentType,
      identity_document_source: "didit",
      identity_document_session_id: input.sessionId,
    })
    .eq("id", input.userId)
    .eq("didit_session_id", input.sessionId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { imported: false, front: true, back: Boolean(back) };
  return { imported: true, front: true, back: Boolean(back) };
}

