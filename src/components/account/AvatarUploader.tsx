"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Loader2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId:           string;
  initialAvatarUrl: string | null;
  fullName:         string;
}

const MAX_BYTES = 5 * 1024 * 1024;  // 5 MB

export function AvatarUploader({ userId, initialAvatarUrl, fullName }: Props) {
  const router      = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const supabase = createClient();

    const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

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
      <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Profile" fill className="object-cover" sizes="80px" />
        ) : initials ? (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xl font-bold">
            {initials}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            <User size={32} />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 bg-stone-900/70 flex items-center justify-center">
            <Loader2 size={20} className="text-amber-300 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <input
          ref={fileInputRef}
          type="file" accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          className="sr-only"
          aria-label="Upload profile picture"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={14} /> {avatarUrl ? "Change photo" : "Upload photo"}
        </button>
        <p className="text-slate-500 text-xs mt-1.5">JPG or PNG, up to 5 MB.</p>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}
