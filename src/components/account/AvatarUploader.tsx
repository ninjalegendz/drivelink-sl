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
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Profile" fill className="object-cover" sizes="80px" />
        ) : initials ? (
          <div className="w-full h-full flex items-center justify-center text-slate-700 text-xl font-bold">
            {initials}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            <User size={32} />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 bg-stone-900/70 flex items-center justify-center">
            <Loader2 size={20} className="text-blue-500 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
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
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 rounded-lg cursor-pointer transition-colors ${loading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Camera size={14} /> {avatarUrl ? "Change photo" : "Upload photo"}
        </label>
        <p className="text-slate-500 text-xs mt-1.5">JPG or PNG, up to 5 MB.</p>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}
