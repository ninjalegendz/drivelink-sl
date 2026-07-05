// Client-side image downscale before upload. A modern phone photo is ~8MP and
// 3–6MB; we serve marketplace images UNOPTIMIZED straight from R2/CDN (no Worker
// resizing), so the uploaded size IS the size every renter downloads. Capping the
// largest dimension + re-encoding to JPEG turns that 5MB original into ~200–400KB.
//
// Any failure (unsupported type, no canvas, decode error) falls back to the
// original file, compression is a best-effort optimisation, never a gate.
export async function compressImage(
  file: File,
  { maxDim = 1600, quality = 0.82 }: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  if (typeof document === "undefined") return file;            // SSR guard
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);

    // Already small in both dimensions and bytes → leave untouched.
    if (scale === 1 && file.size < 1_000_000) {
      bitmap.close?.();
      return file;
    }

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file; // never upsize bytes

    const name = file.name.replace(/\.(png|webp|gif|heic|heif|jpe?g)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
