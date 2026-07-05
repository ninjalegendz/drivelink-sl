"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
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
    <div className="relative w-full h-28 bg-slate-100 rounded-xl overflow-hidden mt-2">
      <Image src={url} alt={label} fill className="object-cover" unoptimized />
    </div>
  );
}

export function KycUploadForm({ userId, existingNicUrl, existingSelfieUrl }: Props) {
  const router = useRouter();

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

    let nicUrl    = existingNicUrl;
    let selfieUrl = existingSelfieUrl;

    if (nicFile) {
      try {
        const out = await uploadToR2("kyc", nicFile);
        nicUrl = out.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? `NIC upload failed: ${err.message}` : "NIC upload failed. Try again.");
        setLoading(false);
        return;
      }
    }

    if (selfieFile) {
      try {
        const out = await uploadToR2("kyc", selfieFile);
        selfieUrl = out.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? `Selfie upload failed: ${err.message}` : "Selfie upload failed. Try again.");
        setLoading(false);
        return;
      }
    }

    const supabase = createClient();
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
        <p className="text-slate-900 text-sm font-medium mb-1">National Identity Card (NIC)</p>
        <p className="text-slate-500 text-xs mb-2">
          Upload a clear photo of your NIC front. JPG or PNG, under 5MB.
        </p>

        {existingNicUrl && !nicFile && (
          <div className="relative w-full h-28 bg-slate-100 rounded-xl overflow-hidden mb-2">
            <Image src={existingNicUrl} alt="NIC" fill className="object-cover" unoptimized />
            <div className="absolute bottom-1 right-2 bg-emerald-500/80 text-white text-xs px-2 py-0.5 rounded">
              Uploaded
            </div>
          </div>
        )}

        <FilePreview file={nicFile} label="NIC preview" />

        <input
          id="kyc-nic-input"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { setNicFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />
        <label
          htmlFor="kyc-nic-input"
          className="mt-2 block w-full px-4 py-2.5 bg-slate-100 border border-slate-200 border-dashed rounded-xl text-slate-600 hover:text-slate-900 hover:border-blue-500 text-sm cursor-pointer transition-colors text-center"
        >
          {nicFile ? "Change NIC photo" : existingNicUrl ? "Replace NIC photo" : "Choose NIC photo"}
        </label>
      </div>

      {/* Selfie */}
      <div>
        <p className="text-slate-900 text-sm font-medium mb-1">Selfie holding your NIC</p>
        <p className="text-slate-500 text-xs mb-2">
          Hold your NIC next to your face. This confirms the document belongs to you.
        </p>

        {existingSelfieUrl && !selfieFile && (
          <div className="relative w-full h-28 bg-slate-100 rounded-xl overflow-hidden mb-2">
            <Image src={existingSelfieUrl} alt="Selfie" fill className="object-cover" unoptimized />
            <div className="absolute bottom-1 right-2 bg-emerald-500/80 text-white text-xs px-2 py-0.5 rounded">
              Uploaded
            </div>
          </div>
        )}

        <FilePreview file={selfieFile} label="Selfie preview" />

        <input
          id="kyc-selfie-input"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { setSelfieFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />
        <label
          htmlFor="kyc-selfie-input"
          className="mt-2 block w-full px-4 py-2.5 bg-slate-100 border border-slate-200 border-dashed rounded-xl text-slate-600 hover:text-slate-900 hover:border-blue-500 text-sm cursor-pointer transition-colors text-center"
        >
          {selfieFile ? "Change selfie" : existingSelfieUrl ? "Replace selfie" : "Choose selfie"}
        </label>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        Submit for verification
      </Button>
    </form>
  );
}
