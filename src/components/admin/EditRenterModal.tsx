"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { toLocalSL } from "@/lib/auth/phone-format";

interface Initial {
  full_name: string;
  phone:     string;
  email:     string | null;
  role:      "renter" | "agency_owner" | "admin";
}

interface Props {
  userId:  string;
  initial: Initial;
  onClose: () => void;
}

const ROLES = [
  { value: "renter",       label: "Renter" },
  { value: "agency_owner", label: "Agency owner" },
  { value: "admin",        label: "Admin" },
] as const;

export function EditRenterModal({ userId, initial, onClose }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name);
  const [phone,    setPhone]    = useState(toLocalSL(initial.phone) ?? initial.phone);
  const [email,    setEmail]    = useState(initial.email ?? "");
  const [role,     setRole]     = useState<Initial["role"]>(initial.role);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        full_name: fullName,
        phone,
        email:     email.trim() || null,
        role,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok && res.status !== 207) { setError(payload.error ?? "Save failed."); return; }
    if (res.status === 207)             { setError(payload.error); /* but still proceed */ }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="animate-bounce-in glass-card rounded-3xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-slate-900 font-semibold">Edit user</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-slate-700 text-xs mb-1 block">Full name</label>
            <input
              type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              required autoFocus
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-slate-700 text-xs mb-1 block">Mobile number</label>
            <PhoneInput value={phone} onChange={setPhone} required />
          </div>
          <div>
            <label className="text-slate-700 text-xs mb-1 block">
              Email <span className="text-slate-400 font-normal">(blank = phone-only)</span>
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-slate-700 text-xs mb-1 block">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Initial["role"])}
              className={inputClass}
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {role !== initial.role && (
              <p className="text-blue-600 text-xs mt-1">
                Role change, this affects what they can do. Confirm before saving.
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={loading}>Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500";
