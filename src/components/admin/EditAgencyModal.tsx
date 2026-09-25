"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SL_CITIES } from "@/data/cities";
import { toLocalSL } from "@/lib/auth/phone-format";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

interface Initial {
  name:            string;
  city:            string;
  address:         string | null;
  whatsapp_number: string;
  description:     string | null;
}

interface Props {
  agencyId: string;
  initial:  Initial;
  onClose:  () => void;
}

export function EditAgencyModal({ agencyId, initial, onClose }: Props) {
  const router = useRouter();
  const [name,    setName]    = useState(initial.name);
  const [city,    setCity]    = useState(initial.city);
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone,   setPhone]   = useState(toLocalSL(initial.whatsapp_number) ?? initial.whatsapp_number);
  const [desc,    setDesc]    = useState(initial.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEscapeLayer(onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const res = await fetch(`/api/admin/agencies/${agencyId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name,
        city,
        address:         address.trim() || null,
        whatsapp_number: phone,
        description:     desc.trim() || null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Save failed."); return; }
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
            <h2 className="text-base font-semibold text-slate-950">Edit Rental Page</h2>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Page name" required>
              {(f) => <Input {...f} type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-800">City</label>
                <Select value={city} onChange={setCity} options={CITY_OPTIONS} label="City" />
              </div>
              <Field label="Address" hint="Optional">
                {(f) => <Input {...f} type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Galle Rd" />}
              </Field>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">Mobile number</label>
              <PhoneInput value={phone} onChange={setPhone} required />
            </div>

            <Field label="Description" hint="Optional">
              {(f) => <Textarea {...f} value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={500} />}
            </Field>

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
