"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Loader2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";

interface Props {
  userId:           string;
  initialAvatarUrl: string | null;
  fullName:         string;
}

const MAX_BYTES = 5 * 1024 * 1024;  // 5 MB

export function AvatarUploader({ userId, initialAvatarUrl, fullName }: Props) {
  const router      = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [, startTransition]       = useTransition();

  async function handleFile(file: File) {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please pick an image file.");
      return;
    }

    setLoading(true);

    let publicUrl: string;
    try {
      const out = await uploadToR2("avatars", file);
      publicUrl = out.publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setAvatarUrl(publicUrl);
    startTransition(() => router.refresh());
  }

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || null;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-800 shadow-xs ring-2 ring-white">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Profile" fill className="object-cover" sizes="80px" />
        ) : initials ? (
          <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-white">
            {initials}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/80">
            <User size={32} />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
            <Loader2 size={20} className="animate-spin text-white" />
          </div>
        )}
        <label
          htmlFor="avatar-upload-input"
          className={`absolute bottom-0 right-0 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-900/[0.06] transition-colors hover:bg-slate-50 ${loading ? "pointer-events-none opacity-50" : ""}`}
          aria-hidden="true"
        >
          <Camera size={13} />
        </label>
      </div>

      <div className="min-w-0 flex-1">
        <input
          id="avatar-upload-input"
          type="file" accept="image/*"
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          className="sr-only"
          aria-label="Upload profile picture"
        />
        <label
          htmlFor="avatar-upload-input"
          className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200 ${loading ? "pointer-events-none opacity-50" : ""}`}
        >
          <Camera size={14} /> {avatarUrl ? "Change photo" : "Upload photo"}
        </label>
        <p className="mt-1.5 text-xs text-slate-500">JPG or PNG, up to 5 MB.</p>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
