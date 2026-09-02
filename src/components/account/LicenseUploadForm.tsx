"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadToR2 } from "@/lib/storage/upload";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

interface Props {
  existingFrontUrl: string | null;
  existingBackUrl: string | null;
  initialDateOfBirth: string | null;
  initialIssuedOn: string | null;
  initialExpiresOn: string | null;
  initialJurisdiction: "sri_lanka" | "foreign" | null;
  reviewStatus: "not_submitted" | "pending" | "verified" | "rejected";
  reviewNote: string | null;
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

const REVIEW_COPY: Record<Props["reviewStatus"], { label: string; className: string; detail: string }> = {
  not_submitted: { label: "Not submitted", className: "bg-slate-100 text-slate-700", detail: "Add the licence details below to request self-drive access." },
  pending: { label: "Under review", className: "bg-amber-100 text-amber-800", detail: "A DriveLink reviewer is checking your licence. You can still request with-driver rentals." },
  verified: { label: "Reviewed", className: "bg-emerald-100 text-emerald-800", detail: "Your licence can be used for self-drive requests that meet the vehicle's own requirements." },
  rejected: { label: "Update needed", className: "bg-rose-100 text-rose-800", detail: "Correct the issue below and submit the licence again for review." },
};

// Front/back driving-licence capture. The private files and the facts a
// reviewer needs go through one server route, which resets review state on
// every update. A renter cannot mark their own licence as approved.
export function LicenseUploadForm({
  existingFrontUrl,
  existingBackUrl,
  initialDateOfBirth,
  initialIssuedOn,
  initialExpiresOn,
  initialJurisdiction,
  reviewStatus,
  reviewNote,
}: Props) {
  const router = useRouter();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile]   = useState<File | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "");
  const [issuedOn, setIssuedOn] = useState(initialIssuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(initialExpiresOn ?? "");
  const [jurisdiction, setJurisdiction] = useState<"sri_lanka" | "foreign">(initialJurisdiction ?? "sri_lanka");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const review = REVIEW_COPY[reviewStatus];

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
        const out = await uploadToR2("licences", frontFile);
        frontUrl = out.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? `Front photo upload failed: ${err.message}` : "Front photo upload failed. Try again.");
        setLoading(false);
        return;
      }
    }

    if (backFile) {
      try {
        const out = await uploadToR2("licences", backFile);
        backUrl = out.publicUrl;
      } catch (err) {
        setError(err instanceof Error ? `Back photo upload failed: ${err.message}` : "Back photo upload failed. Try again.");
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/account/license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frontUrl,
        backUrl,
        dateOfBirth,
        issuedOn,
        expiresOn,
        jurisdiction,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(payload.error ?? "Submission failed. Please try again."); return; }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={`rounded-lg px-3 py-2.5 text-xs ${review.className}`}>
        <p className="font-semibold">{review.label}</p>
        <p className="mt-0.5 leading-5">{review.detail}</p>
        {reviewStatus === "rejected" && reviewNote && <p className="mt-2 font-medium">Reviewer note: {reviewNote}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Date of birth</span>
          <input required type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Licence first issue date</span>
          <input required type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm text-slate-700 sm:col-span-2">
          <span className="mb-1 block font-medium">Licence expiry date</span>
          <input required type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-900">Where was this driving licence issued?</legend>
        <p className="mt-1 text-xs leading-5 text-slate-500">This helps us ask for the right original document at handover. It is not legal advice or a permit decision.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            ["sri_lanka", "Sri Lanka"],
            ["foreign", "Another country"],
          ] as const).map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${jurisdiction === value ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"}`}>
              <input className="sr-only" type="radio" name="license-jurisdiction" value={value} checked={jurisdiction === value} onChange={() => setJurisdiction(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

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
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
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
          Upload a clear JPG or PNG photo of the back of your driving licence, under 5MB.
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
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
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

      {error && <p role="alert" className="text-rose-600 text-sm">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        {reviewStatus === "verified" ? "Update and resubmit driving licence" : "Submit driving licence for review"}
      </Button>
    </form>
  );
}
