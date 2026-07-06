"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

interface Props {
  userId: string;
  existingFrontUrl: string | null;
  existingBackUrl: string | null;
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

// Front/back driving-licence capture. Pattern-matched on KycUploadForm:
// same "kyc" storage prefix (owner-id-keyed, unguessable UUID paths — no
// compression, legibility matters more than bytes) and the same direct
// client-side write onto `profiles` (no API route in between).
export function LicenseUploadForm({ userId, existingFrontUrl, existingBackUrl }: Props) {
  const router = useRouter();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile]   = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const hasFront = frontFile || existingFrontUrl;
    const hasBack  = backFile || existingBackUrl;

    if (!hasFront || !hasBack) {
      setError("Please upload both the front and back of your driving licence.");
      return;
    }

    setLoading(true);
    setError(null);

    let frontUrl = existingFrontUrl;
    let backUrl  = existingBackUrl;

    if (frontFile) {
      try {
        const out = await uploadToR2("kyc", frontFile);
        frontUrl = out.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? `Front photo upload failed: ${err.message}` : "Front photo upload failed. Try again.");
        setLoading(false);
        return;
      }
    }

    if (backFile) {
      try {
        const out = await uploadToR2("kyc", backFile);
        backUrl = out.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? `Back photo upload failed: ${err.message}` : "Back photo upload failed. Try again.");
        setLoading(false);
        return;
      }
    }

    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ license_front_url: frontUrl, license_back_url: backUrl })
      .eq("id", userId);

    setLoading(false);
    if (upErr) { setError("Submission failed. Please try again."); return; }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Front */}
      <div>
        <p className="text-slate-900 text-sm font-medium mb-1">Licence, front</p>
        <p className="text-slate-500 text-xs mb-2">
          Upload a clear photo of the front of your driving licence. JPG or PNG, under 5MB.
        </p>

        {existingFrontUrl && !frontFile && (
          <div className="relative w-full h-28 bg-slate-100 rounded-xl overflow-hidden mb-2">
            <Image src={existingFrontUrl} alt="Licence front" fill className="object-cover" unoptimized />
            <div className="absolute bottom-1 right-2 bg-emerald-500/80 text-white text-xs px-2 py-0.5 rounded">
              Uploaded
            </div>
          </div>
        )}

        <FilePreview file={frontFile} label="Licence front preview" />

        <input
          id="license-front-input"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { setFrontFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />
        <label
          htmlFor="license-front-input"
          className="mt-2 block w-full px-4 py-2.5 bg-slate-100 border border-slate-200 border-dashed rounded-xl text-slate-600 hover:text-slate-900 hover:border-blue-500 text-sm cursor-pointer transition-colors text-center"
        >
          {frontFile ? "Change front photo" : existingFrontUrl ? "Replace front photo" : "Choose front photo"}
        </label>
      </div>

      {/* Back */}
      <div>
        <p className="text-slate-900 text-sm font-medium mb-1">Licence, back</p>
        <p className="text-slate-500 text-xs mb-2">
          Upload a clear photo of the back of your driving licence.
        </p>

        {existingBackUrl && !backFile && (
          <div className="relative w-full h-28 bg-slate-100 rounded-xl overflow-hidden mb-2">
            <Image src={existingBackUrl} alt="Licence back" fill className="object-cover" unoptimized />
            <div className="absolute bottom-1 right-2 bg-emerald-500/80 text-white text-xs px-2 py-0.5 rounded">
              Uploaded
            </div>
          </div>
        )}

        <FilePreview file={backFile} label="Licence back preview" />

        <input
          id="license-back-input"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { setBackFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />
        <label
          htmlFor="license-back-input"
          className="mt-2 block w-full px-4 py-2.5 bg-slate-100 border border-slate-200 border-dashed rounded-xl text-slate-600 hover:text-slate-900 hover:border-blue-500 text-sm cursor-pointer transition-colors text-center"
        >
          {backFile ? "Change back photo" : existingBackUrl ? "Replace back photo" : "Choose back photo"}
        </label>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        Save driving licence
      </Button>
    </form>
  );
}
