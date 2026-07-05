"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Block {
  id:         string;
  start_date: string;
  end_date:   string;
  reason:     string | null;
  created_at: string;
}

interface Props {
  vehicleId: string;
  agencyId:  string;
  initial:   Block[];
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(start).toLocaleDateString("en-LK", opts);
  const e = new Date(end).toLocaleDateString("en-LK", opts);
  return `${s} → ${e}`;
}

export function AvailabilityManager({ vehicleId, agencyId, initial }: Props) {
  const router  = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [start,  setStart]  = useState("");
  const [end,    setEnd]    = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!start || !end) { setError("Pick a start and end date."); return; }
    if (end <= start)   { setError("End date must be after the start date."); return; }

    setAdding(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("vehicle_blocks")
      .insert({
        vehicle_id: vehicleId,
        agency_id:  agencyId,
        start_date: start,
        end_date:   end,
        reason:     reason.trim() || null,
      })
      .select("id, start_date, end_date, reason, created_at")
      .single();

    setAdding(false);
    if (insertError) { setError(insertError.message); return; }

    setBlocks((prev) =>
      [...prev, data as Block].sort((a, b) => a.start_date.localeCompare(b.start_date))
    );
    setStart(""); setEnd(""); setReason("");
    startTransition(() => router.refresh());
  }

  async function removeBlock(id: string) {
    if (!confirm("Remove this blocked period? Renters will be able to book these dates again.")) return;

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("vehicle_blocks")
      .delete()
      .eq("id", id);

    if (deleteError) { setError(deleteError.message); return; }

    setBlocks((prev) => prev.filter((b) => b.id !== id));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">

      {/* Add new */}
      <form onSubmit={addBlock} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <h2 className="text-slate-900 font-semibold text-sm">Block a date range</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-600 text-xs mb-1 block">Start date</label>
            <input
              type="date"
              value={start}
              min={today}
              onChange={(e) => setStart(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-600 text-xs mb-1 block">End date</label>
            <input
              type="date"
              value={end}
              min={start || today}
              onChange={(e) => setEnd(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-slate-600 text-xs mb-1 block">Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. service, owner using, deep clean"
            maxLength={120}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-slate-500 text-xs mt-1">Internal note, renters only see the dates as unavailable, not the reason.</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button type="submit" loading={adding}>
          <Plus size={14} /> Block these dates
        </Button>
      </form>

      {/* Existing blocks */}
      <div>
        <h2 className="text-slate-900 font-semibold text-sm mb-3">Active blocks</h2>
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CalendarX size={32} strokeWidth={1.5} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm">No blocked periods yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-slate-900 text-sm font-medium">{formatRange(b.start_date, b.end_date)}</p>
                  {b.reason && (
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{b.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeBlock(b.id)}
                  className="shrink-0 inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-medium"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
