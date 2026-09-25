"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";
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
  { value: "agency_owner", label: "Rental Page owner" },
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
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEscapeLayer(onClose);

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
    <Portal>
      <div className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          className="animate-scale-in max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/[0.06]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-base font-semibold text-slate-950">Edit renter</h2>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name" required>
              {(f) => <Input {...f} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />}
            </Field>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">Mobile number</label>
              <PhoneInput value={phone} onChange={setPhone} required />
            </div>

            <Field label="Email" hint="Blank means phone-only.">
              {(f) => <Input {...f} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />}
            </Field>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">Role</label>
              <Select value={role} onChange={(v) => setRole(v as Initial["role"])} options={ROLES} label="Role" />
              {role !== initial.role && (
                <p className="mt-1.5 text-xs font-medium text-blue-700">
                  Role change, this affects what they can do. Confirm before saving.
                </p>
              )}
            </div>

            {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={loading}>Save</Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
