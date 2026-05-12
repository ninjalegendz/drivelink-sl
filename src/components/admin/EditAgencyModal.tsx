"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
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
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="animate-bounce-in glass-card rounded-3xl w-full max-w-md p-5 my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-white font-semibold">Edit agency</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-slate-300 text-xs mb-1 block">Agency name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              required autoFocus
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-300 text-xs mb-1 block">City</label>
              <Select value={city} onChange={setCity} options={CITY_OPTIONS} />
            </div>
            <div>
              <label className="text-slate-300 text-xs mb-1 block">
                Address <span className="text-slate-600 font-normal">(opt)</span>
              </label>
              <input
                type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="14 Galle Rd"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs mb-1 block">Mobile number</label>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              required placeholder="0771234567"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs mb-1 block">
              Description <span className="text-slate-600 font-normal">(opt)</span>
            </label>
            <textarea
              value={desc} onChange={(e) => setDesc(e.target.value)}
              rows={3} maxLength={500}
              className={`${inputClass} resize-none`}
            />
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
  "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500";
