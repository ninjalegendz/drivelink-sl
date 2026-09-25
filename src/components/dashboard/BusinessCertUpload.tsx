"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Button } from "@/components/ui/Button";

// PAGE-006: business registration - the number + the certificate image/PDF.
// The cert is private (business-docs prefix); only the page owner + admin can
// view it via /api/docs. An admin cross-checks the number against the cert
// before marking the page a verified business.
export function BusinessCertUpload({
  agencyId,
  existingUrl,
  existingRegNo,
}: {
  agencyId: string;
  existingUrl: string | null;
  existingRegNo: string | null;
}) {
  const router = useRouter();
  const [regNo, setRegNo]   = useState(existingRegNo ?? "");
  const [file, setFile]     = useState<File | null>(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [done, setDone]     = useState(false);

  const regNoChanged = regNo.trim() !== (existingRegNo ?? "").trim();
  const canSave = !!file || regNoChanged;

  async function submit() {
    if (!canSave) return;
    setBusy(true); setError(null);
    try {
      const patch: { business_reg_no?: string | null; business_reg_url?: string } = {};
      if (regNoChanged) patch.business_reg_no = regNo.trim() || null;
      if (file) {
        const { publicUrl } = await uploadToR2("business-docs", file);
        patch.business_reg_url = publicUrl;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.from("agencies").update(patch).eq("id", agencyId);
      if (upErr) throw new Error(upErr.message);
      setDone(true);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed. Try again.");
    }
    setBusy(false);
  }

  const hasCert = !!existingUrl || done;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-800">Business registration number</span>
        <input
          type="text"
          value={regNo}
          onChange={(e) => { setRegNo(e.target.value); setDone(false); }}
          placeholder="e.g. PV 00123456"
          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
        />
      </label>

      <div className="space-y-2">
        {hasCert && (
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Check size={13} aria-hidden="true" /> Certificate on file{done ? " (updated)" : ""}
          </p>
        )}
        <label className="block">
          <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDone(false); }} />
          <span className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-600 transition-colors hover:border-blue-500 hover:text-slate-900">
            <FileText size={14} aria-hidden="true" /> {file ? file.name : hasCert ? "Replace certificate" : "Choose certificate (image or PDF)"}
          </span>
        </label>
      </div>

      {canSave && (
        <Button size="sm" loading={busy} onClick={submit}><Upload size={13} aria-hidden="true" /> Save business details</Button>
      )}
      {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}
