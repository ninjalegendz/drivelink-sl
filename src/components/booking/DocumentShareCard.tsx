"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  bookingId:      string;
  pageName:       string;
  consentGranted: boolean;
  /** Revocation is only allowed while the booking is active. */
  canRevoke:      boolean;
}

export function DocumentShareCard({ bookingId, pageName, consentGranted, canRevoke }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function call(method: "POST" | "DELETE") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/consent`, { method });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error((p as { error?: string }).error ?? "Something went wrong.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (consentGranted) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-emerald-700 font-semibold text-sm">Documents shared with {pageName}</p>
            <p className="text-slate-600 text-xs mt-0.5">
              Your identity summary and driving licence photos are viewable (not downloadable) by{" "}
              {pageName} for this booking only. Every view is logged, see your{" "}
              <Link href="/account/documents" className="underline hover:text-slate-800">
                sharing history
              </Link>.
            </p>
            {canRevoke && (
              <button
                type="button"
                onClick={() => call("DELETE")}
                disabled={loading}
                className="mt-2 text-xs text-slate-500 hover:text-red-500 disabled:opacity-50 transition-colors"
              >
                {loading ? "Stopping…" : "Stop sharing"}
              </button>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Eye size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-slate-900 font-semibold text-sm">Document sharing</p>
          <p className="text-slate-600 text-xs mt-1">
            Your verified identity summary and driving licence photos become viewable (not
            downloadable) by {pageName} for this booking only. Every view is logged and visible
            to you.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Button size="sm" onClick={() => call("POST")} loading={loading}>
              Share documents
            </Button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Not now
            </button>
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
