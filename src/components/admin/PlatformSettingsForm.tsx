"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Initial {
  bank_account_name:   string;
  bank_name:           string;
  bank_account_number: string;
  bank_branch:         string;
}

interface Props {
  initial:   Initial;
  updatedAt: string | null;
}

export function PlatformSettingsForm({ initial, updatedAt }: Props) {
  const router = useRouter();
  const [form, setForm]     = useState(initial);
  const [saving, setSaving] = useState(false);
  const [info, setInfo]     = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function field<K extends keyof Initial>(k: K, v: Initial[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setInfo(null);

    const res = await fetch("/api/admin/platform-settings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        bank_account_name:   form.bank_account_name.trim(),
        bank_name:           form.bank_name.trim(),
        bank_account_number: form.bank_account_number.trim(),
        bank_branch:         form.bank_branch.trim() || null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) { setError(payload.error ?? "Save failed."); return; }
    setInfo("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div>
        <label className="text-slate-300 text-xs font-medium mb-1.5 block">Account holder name</label>
        <input
          type="text"
          value={form.bank_account_name}
          onChange={(e) => field("bank_account_name", e.target.value)}
          required
          placeholder="DriveLink SL"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-300 text-xs font-medium mb-1.5 block">Bank</label>
          <input
            type="text"
            value={form.bank_name}
            onChange={(e) => field("bank_name", e.target.value)}
            required
            placeholder="Commercial Bank"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-slate-300 text-xs font-medium mb-1.5 block">Account number</label>
          <input
            type="text"
            value={form.bank_account_number}
            onChange={(e) => field("bank_account_number", e.target.value)}
            required
            placeholder="8001234567"
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>

      <div>
        <label className="text-slate-300 text-xs font-medium mb-1.5 block">
          Branch <span className="text-slate-600 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={form.bank_branch}
          onChange={(e) => field("bank_branch", e.target.value)}
          placeholder="Colombo Fort"
          className={inputClass}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {info  && <p className="text-emerald-400 text-sm">{info}</p>}
      {updatedAt && (
        <p className="text-slate-600 text-xs">
          Last updated {new Date(updatedAt).toLocaleString("en-LK")}.
        </p>
      )}

      <Button type="submit" loading={saving}>
        <Save size={14} /> Save
      </Button>
    </form>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500";
