"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Check, X } from "lucide-react";
import { uploadToR2 } from "@/lib/storage/upload";

interface Props {
  bookingId:     string;
  initialPickup: string[];
  initialReturn: string[];
}

/**
 * Pickup / return condition photos (plan §7/§14/§18). Protects both sides
 * against false damage claims, photograph the body, fuel gauge, and
 * odometer at handover and again at return. Saved via the secure
 * /api/bookings/[id]/photos route.
 */
export function HandoverPhotos({ bookingId, initialPickup, initialReturn }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 space-y-4">
      <div>
        <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold">Handover condition photos</p>
        <p className="text-slate-500 text-xs mt-1">
          Photograph the vehicle&apos;s body, fuel gauge and odometer at pickup and again at return. This protects you and the provider from false damage claims.
        </p>
      </div>
      <Stage bookingId={bookingId} stage="pickup" label="Pickup photos" initial={initialPickup} />
      <Stage bookingId={bookingId} stage="return" label="Return photos" initial={initialReturn} />
    </div>
  );
}

function Stage({ bookingId, stage, label, initial }: { bookingId: string; stage: "pickup" | "return"; label: string; initial: string[] }) {
  const router = useRouter();
  const inputId = useId();
  const [photos, setPhotos] = useState<string[]>(initial ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const out = await uploadToR2("booking-photos", file);
        uploaded.push(out.publicUrl);
      }
      const next = [...photos, ...uploaded].slice(0, 12);
      const res = await fetch(`/api/bookings/${bookingId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, urls: next }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error((p as { error?: string }).error ?? "Failed to save photos");
      }
      setPhotos(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(url: string) {
    const next = photos.filter((p) => p !== url);
    setBusy(true);
    const res = await fetch(`/api/bookings/${bookingId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, urls: next }),
    });
    setBusy(false);
    if (res.ok) { setPhotos(next); router.refresh(); }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
          {label}
          {photos.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700"><Check size={11} /> {photos.length}</span>
          )}
        </p>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors ${busy ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Camera size={13} /> {busy ? "Uploading…" : photos.length ? "Add more" : "Upload"}
        </label>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((url) => (
            <div key={url} className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group">
              <Image src={url} alt="Handover photo" fill className="object-cover" sizes="120px" />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 hover:bg-rose-500 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition flex items-center justify-center"
                aria-label="Remove photo"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-rose-600 text-xs">{error}</p>}
    </div>
  );
}
