"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatLKR } from "@/lib/vehicles/format";
import {
  CHARGE_KINDS, CHARGE_KIND_LABELS, computeSettlement,
  type ChargeKind, type ChargeLine,
} from "@/lib/booking/settlement";

interface Props {
  bookingId:          string;
  mode:               "owner" | "renter";
  rentalSubtotalLkr:  number;
  depositHeldLkr:     number;
  settlementAckAt:    string | null;
}

// BUILD 3 - the return settlement both sides see. The owner itemises extra
// charges (fuel, late, damage…); everyone sees the deposit netted to one
// figure; the renter accepts, which locks the ledger.
export function ChargeLedger({ bookingId, mode, rentalSubtotalLkr, depositHeldLkr, settlementAckAt }: Props) {
  const router = useRouter();
  const [charges, setCharges] = useState<ChargeLine[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [kind, setKind]       = useState<ChargeKind>("fuel");
  const [label, setLabel]     = useState("");
  const [amount, setAmount]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [acked, setAcked]     = useState(!!settlementAckAt);

  useEffect(() => {
    let off = false;
    (async () => {
      const res = await fetch(`/api/bookings/${bookingId}/charges`);
      const p = await res.json().catch(() => ({}));
      if (!off) { setCharges((p.charges ?? []) as ChargeLine[]); setLoaded(true); }
    })();
    return () => { off = true; };
  }, [bookingId]);

  const s = computeSettlement({ rentalSubtotalLkr, depositHeldLkr, charges });
  const locked = acked;

  async function addCharge(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt < 0) { setError("Enter a valid amount."); return; }
    setBusy(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/charges`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: label.trim() || null, amount_lkr: amt }),
    });
    const p = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(p.error ?? "Couldn't add the charge."); return; }
    setCharges((c) => [...c, p.charge as ChargeLine]);
    setLabel(""); setAmount("");
  }

  async function removeCharge(chargeId: string) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/charges/${chargeId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p.error ?? "Couldn't remove."); return; }
    setCharges((c) => c.filter((x) => x.id !== chargeId));
  }

  async function accept() {
    if (!confirm(`Accept this settlement? ${netLabel(s.netLkr)}. This confirms the final charges for your rental.`)) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/settlement`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p.error ?? "Couldn't accept."); return; }
    setAcked(true);
    router.refresh();
  }

  if (!loaded) return <div className="text-slate-400 text-xs">Loading settlement…</div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-slate-900">Return settlement</p>
        {locked && (
          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
            <Check size={12} /> Accepted
          </span>
        )}
      </div>

      {/* Line items */}
      <div className="space-y-1">
        <Row k="Rental (paid at pickup)" v={formatLKR(s.rentalSubtotalLkr)} muted />
        {s.charges.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2">
            <span className="text-slate-700">
              {CHARGE_KIND_LABELS[c.kind]}{c.label ? `: ${c.label}` : ""}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-slate-900">+{formatLKR(c.amount_lkr)}</span>
              {mode === "owner" && !locked && (
                <button type="button" onClick={() => removeCharge(c.id)} disabled={busy}
                  className="text-slate-400 hover:text-red-500 disabled:opacity-50" aria-label="Remove">
                  <Trash2 size={13} />
                </button>
              )}
            </span>
          </div>
        ))}
        {s.charges.length === 0 && <p className="text-slate-400 text-xs">No extra charges added.</p>}
        {s.depositHeldLkr > 0 && <Row k="Security deposit held" v={`. ${formatLKR(s.depositHeldLkr)}`} />}
      </div>

      {/* Net */}
      <div className="border-t border-slate-200 mt-2 pt-2 flex items-center justify-between font-semibold">
        <span className="text-slate-900">{netLabel(s.netLkr)}</span>
        <span className={s.netLkr > 0 ? "text-red-600" : s.netLkr < 0 ? "text-emerald-700" : "text-slate-900"}>
          {formatLKR(Math.abs(s.netLkr))}
        </span>
      </div>

      {/* Owner: add a charge */}
      {mode === "owner" && !locked && (
        <form onSubmit={addCharge} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
          <select value={kind} onChange={(e) => setKind(e.target.value as ChargeKind)}
            className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-xs">
            {CHARGE_KINDS.map((k) => <option key={k} value={k}>{CHARGE_KIND_LABELS[k]}</option>)}
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Note (optional)"
            className="flex-1 min-w-[100px] px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-xs" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Rs."
            className="w-24 px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-xs" />
          <Button type="submit" size="sm" loading={busy}><Plus size={13} /> Add</Button>
        </form>
      )}

      {/* Renter: accept */}
      {mode === "renter" && !locked && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <Button size="sm" onClick={accept} loading={busy} className="w-full">
            <Check size={14} /> Accept settlement
          </Button>
          <p className="text-slate-400 text-[11px] mt-1 text-center">
            Payment is settled directly with the {`Rental Page`}; this records what you both agreed.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}

function netLabel(net: number): string {
  if (net > 0) return "Renter still owes";
  if (net < 0) return "Owner refunds renter";
  return "Settled: nothing owed";
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-400" : "text-slate-700"}>{k}</span>
      <span className={muted ? "text-slate-400" : "text-slate-900"}>{v}</span>
    </div>
  );
}
