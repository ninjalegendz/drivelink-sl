"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  userId: string;
  status: string;
}

export function LicenseReviewActions({ userId, status }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [saving, setSaving] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(nextStatus: "verified" | "rejected") {
    setSaving(nextStatus === "verified" ? "approve" : "reject");
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/license`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, note }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "Could not save this review.");
      setSaving(null);
      return;
    }
    window.location.reload();
  }

  if (status === "verified") return <span className="text-xs font-medium text-emerald-700">Licence reviewed</span>;
  if (status === "not_submitted") return <span className="text-xs text-slate-500">No licence submitted</span>;

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-medium text-slate-700">Driving-licence review</p>
      {status === "rejected" && <p className="mt-1 text-xs text-rose-700">Waiting for the renter to submit an updated licence.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" loading={saving === "approve"} onClick={() => submit("verified")}>
          <Check size={14} /> Approve licence
        </Button>
        <Button size="sm" variant="danger" onClick={() => setShowReject(true)}>
          <X size={14} /> Request update
        </Button>
      </div>
      {showReject && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`license-note-${userId}`}>What should the renter correct?</label>
          <textarea id={`license-note-${userId}`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Button size="sm" variant="danger" loading={saving === "reject"} onClick={() => submit("rejected")}>Send update request</Button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
