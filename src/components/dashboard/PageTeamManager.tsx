"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface TeamMember {
  userId: string;
  name:   string | null;
  email:  string | null;
}

export function PageTeamManager({ agencyId, initial }: { agencyId: string; initial: TeamMember[] }) {
  const router = useRouter();
  const [email, setEmail]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function add() {
    const value = email.trim();
    if (!value) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/members`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't add staff.");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add staff.");
    }
    setBusy(false);
  }

  async function remove(userId: string) {
    setRemoving(userId); setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/members/${userId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't remove staff.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove staff.");
    }
    setRemoving(null);
  }

  return (
    <div className="space-y-3">
      {initial.length > 0 && (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {initial.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-medium truncate">{m.name || m.email || "Staff member"}</p>
                {m.name && m.email && <p className="text-slate-500 text-xs truncate">{m.email}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(m.userId)}
                disabled={removing === m.userId}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600 text-xs font-medium disabled:opacity-50 shrink-0"
              >
                <X size={14} /> {removing === m.userId ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="teammate's account email"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <Button size="sm" loading={busy} onClick={add}><UserPlus size={13} /> Add</Button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
