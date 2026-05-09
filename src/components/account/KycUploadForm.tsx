"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

interface Props {
  userId: string;
  existingNicUrl: string | null;
  existingSelfieUrl: string | null;
}

function FilePreview({ file, label }: { file: File | null; label: string }) {
  if (!file) return null;
  const url = URL.createObjectURL(file);
  return (
    <div className="relative w-full h-28 bg-slate-800 rounded-xl overflow-hidden mt-2">
      <Image src={url} alt={label} fill className="object-cover" unoptimized />
    </div>
  );
}

export function KycUploadForm({ userId, existingNicUrl, existingSelfieUrl }: Props) {
  const router = useRouter();
  const nicRef    = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const [nicFile, setNicFile]       = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const hasNic    = nicFile || existingNicUrl;
    const hasSelfie = selfieFile || existingSelfieUrl;

    if (!hasNic || !hasSelfie) {
      setError("Please upload both your NIC photo and a selfie.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();

    let nicUrl    = existingNicUrl;
    let selfieUrl = existingSelfieUrl;

    if (nicFile) {
      const ext  = nicFile.name.split(".").pop();
      const path = `${userId}/nic.${ext}`;
      const { error: up } = await supabase.storage
        .from("kyc").upload(path, nicFile, { upsert: true });
      if (up) { setError("NIC upload failed. Try again."); setLoading(false); return; }
      nicUrl = supabase.storage.from("kyc").getPublicUrl(path).data.publicUrl;
    }

    if (selfieFile) {
      const ext  = selfieFile.name.split(".").pop();
      const path = `${userId}/selfie.${ext}`;
      const { error: up } = await supabase.storage
        .from("kyc").upload(path, selfieFile, { upsert: true });
      if (up) { setError("Selfie upload failed. Try again."); setLoading(false); return; }
      selfieUrl = supabase.storage.from("kyc").getPublicUrl(path).data.publicUrl;
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ nic_url: nicUrl, selfie_url: selfieUrl, kyc_status: "pending" })
      .eq("id", userId);

    setLoading(false);
    if (upErr) { setError("Submission failed. Please try again."); return; }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* NIC */}
      <div>
        <p className="text-white text-sm font-medium mb-1">National Identity Card (NIC)</p>
        <p className="text-slate-500 text-xs mb-2">
          Upload a clear photo of your NIC front. JPG or PNG, under 5MB.
        </p>

        {existingNicUrl && !nicFile && (
          <div className="relative w-full h-28 bg-slate-800 rounded-xl overflow-hidden mb-2">
            <Image src={existingNicUrl} alt="NIC" fill className="object-cover" unoptimized />
            <div className="absolute bottom-1 right-2 bg-emerald-500/80 text-white text-xs px-2 py-0.5 rounded">
              Uploaded
            </div>
          </div>
        )}

        <FilePreview file={nicFile} label="NIC preview" />

        <button
          type="button"
          onClick={() => nicRef.current?.click()}
          className="mt-2 w-full px-4 py-2.5 bg-slate-800 border border-slate-700 border-dashed rounded-xl text-slate-400 hover:text-white hover:border-amber-500 text-sm transition-colors text-center"
        >
          {nicFile ? "Change NIC photo" : existingNicUrl ? "Replace NIC photo" : "Choose NIC photo"}
        </button>
        <input
          ref={nicRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setNicFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Selfie */}
      <div>
        <p className="text-white text-sm font-medium mb-1">Selfie holding your NIC</p>
        <p className="text-slate-500 text-xs mb-2">
          Hold your NIC next to your face. This confirms the document belongs to you.
        </p>

        {existingSelfieUrl && !selfieFile && (
          <div className="relative w-full h-28 bg-slate-800 rounded-xl overflow-hidden mb-2">
            <Image src={existingSelfieUrl} alt="Selfie" fill className="object-cover" unoptimized />
            <div className="absolute bottom-1 right-2 bg-emerald-500/80 text-white text-xs px-2 py-0.5 rounded">
              Uploaded
            </div>
          </div>
        )}

        <FilePreview file={selfieFile} label="Selfie preview" />

        <button
          type="button"
          onClick={() => selfieRef.current?.click()}
          className="mt-2 w-full px-4 py-2.5 bg-slate-800 border border-slate-700 border-dashed rounded-xl text-slate-400 hover:text-white hover:border-amber-500 text-sm transition-colors text-center"
        >
          {selfieFile ? "Change selfie" : existingSelfieUrl ? "Replace selfie" : "Choose selfie"}
        </button>
        <input
          ref={selfieRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        Submit for verification
      </Button>
    </form>
  );
}
