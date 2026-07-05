"use client";

// Client-side pieces of the digital rental agreement page: the accept
// button (posts to /api/bookings/[id]/agreement/accept, never a direct
// supabase write), a print button (the page IS the PDF, print-to-PDF),
// and the collapsed-by-default "Show to police" checkpoint card.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ─── Accept ──────────────────────────────────────────────────────────────

export function AcceptAgreementButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [, startTransition]   = useTransition();

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/agreement/accept`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((payload as { error?: string }).error ?? "Couldn't record your acceptance. Try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="print:hidden">
      <Button size="sm" loading={loading} onClick={accept}>
        <Check size={14} /> Accept agreement
      </Button>
      <p className="text-slate-500 text-[11px] mt-1.5">
        Accepting records the time and your device as your signature.
      </p>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ─── Print ───────────────────────────────────────────────────────────────

export function PrintAgreementButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
    >
      <Printer size={13} /> Print / save PDF
    </button>
  );
}

// ─── Show to police ──────────────────────────────────────────────────────

export interface PoliceSummaryProps {
  bookingRef:    string;
  vehicleName:   string;   // "2019 Toyota Aqua"
  plateNumber:   string | null;
  periodLabel:   string;   // "12 Jul 2026 10:00 → 15 Jul 2026 10:00"
  renterName:    string;
  renterVerified: boolean;
  ownerName:     string;
  ownerPhone:    string;
}

/**
 * High-contrast checkpoint card, collapsed by default. Designed to be
 * handed over at a police stop: big vehicle + plate, the rental window,
 * who is driving and who owns the listing, and the booking reference.
 */
export function PoliceSummary(props: PoliceSummaryProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" /> Show to police
        </span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl bg-slate-900 text-white p-5 space-y-4">
          <div>
            <p className="text-slate-400 text-[11px] uppercase tracking-widest font-semibold">Vehicle</p>
            <p className="text-xl font-extrabold leading-tight">{props.vehicleName}</p>
            {props.plateNumber && (
              <p className="mt-1 inline-block px-3 py-1 rounded-lg bg-white text-slate-950 font-mono font-extrabold text-lg tracking-widest">
                {props.plateNumber}
              </p>
            )}
          </div>

          <div>
            <p className="text-slate-400 text-[11px] uppercase tracking-widest font-semibold">Rental window</p>
            <p className="font-semibold">{props.periodLabel}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-[11px] uppercase tracking-widest font-semibold">Renter</p>
              <p className="font-semibold">{props.renterName}</p>
              {props.renterVerified && (
                <p className="text-emerald-400 text-xs mt-0.5 inline-flex items-center gap-1">
                  <ShieldCheck size={12} /> Identity verified via DriveLink
                </p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-[11px] uppercase tracking-widest font-semibold">Vehicle owner</p>
              <p className="font-semibold">{props.ownerName}</p>
              <p className="text-slate-300 text-sm font-mono">{props.ownerPhone}</p>
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-[11px] uppercase tracking-widest font-semibold">Booking reference</p>
            <p className="font-mono font-bold text-lg tracking-widest">{props.bookingRef}</p>
          </div>
        </div>
      )}

      {open && (
        <p className="text-slate-600 text-xs mt-2 text-center">
          This vehicle is on a documented rental through DriveLink (drivelink.lk).
        </p>
      )}
    </div>
  );
}
