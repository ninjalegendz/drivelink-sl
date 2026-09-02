"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, FileKey2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  bookingId: string;
  pageName: string;
  consentGranted: boolean;
  canRevoke: boolean;
}
export function DocumentShareCard({ bookingId, pageName, consentGranted, canRevoke }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/consent`, { method });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Could not update document sharing. Check your connection and try again.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update document sharing. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (consentGranted) {
    return (
      <section className="mb-4 border-y border-emerald-200 bg-emerald-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-emerald-900">Documents shared with {pageName}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-700">
              The page owner and staff who were separately granted renter-document permission may request your approved government ID and driving licence for this booking. Your liveness selfie is never shared. DriveLink watermarks and logs each server request. Screenshots and photographs cannot be completely prevented.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/account/documents" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 underline underline-offset-2">
                <Eye size={13} /> See access history
              </Link>
              {canRevoke && (
                <button
                  type="button"
                  onClick={() => call("DELETE")}
                  disabled={loading}
                  className="text-xs font-medium text-rose-700 hover:text-rose-800 disabled:opacity-50"
                >
                  {loading ? "Stopping..." : "Stop future access"}
                </button>
              )}
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
          </div>
        </div>
      </section>
    );
  }

  if (dismissed) return null;

  return (
    <section className="mb-4 border-y border-slate-200 bg-white px-4 py-4">
      <div className="flex items-start gap-3">
        <FileKey2 size={19} className="mt-0.5 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Share documents for this booking?</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            This lets authorised people at {pageName} request your approved government ID and driving licence only while this booking needs them. Your liveness selfie is never shared. Each image carries the booking, page, viewer and time, and each request appears in your access history.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Share only after checking that this is the Rental Page you intend to rent from. Watermarks discourage misuse but cannot stop screenshots or camera photos.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => call("POST")} loading={loading}>
              <ShieldCheck size={14} /> Share for this booking
            </Button>
            <button type="button" onClick={() => setDismissed(true)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Not now
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
