"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2 } from "@/lib/storage/upload";
import { Button } from "@/components/ui/Button";

export function SlipUploadForm({ bookingId }: { bookingId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    let publicUrl: string;
    try {
      const out = await uploadToR2("booking-slips", file);
      publicUrl = out.publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ slip_url: publicUrl, status: "payment_pending" })
      .eq("id", bookingId);

    setLoading(false);

    if (updateError) {
      setError("Could not update booking. Contact support.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm">
        Slip uploaded. We are verifying your payment — you will be notified shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <div>
        <label className="text-slate-400 text-xs mb-1 block">Upload bank transfer slip</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white file:text-sm file:cursor-pointer cursor-pointer"
          required
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} disabled={!file} className="w-full">
        Submit slip for verification
      </Button>
    </form>
  );
}
