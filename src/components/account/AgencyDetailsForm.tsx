"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

interface Props {
  agencyId:           string;
  initialName:        string;
  initialCity:        string;
  initialAddress:     string | null;
  initialPhone:       string;
  initialDescription: string | null;
}

export function AgencyDetailsForm({
  agencyId,
  initialName,
  initialCity,
  initialAddress,
  initialPhone,
  initialDescription,
}: Props) {
  const router = useRouter();
  const [name, setName]               = useState(initialName);
  const [city, setCity]               = useState(initialCity);
  const [address, setAddress]         = useState(initialAddress ?? "");
  const [phone, setPhone]             = useState(initialPhone);
  const [description, setDescription] = useState(initialDescription ?? "");

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [, startTransition]           = useTransition();

  const dirty =
    name.trim()        !== initialName.trim() ||
    city               !== initialCity ||
    address.trim()     !== (initialAddress ?? "").trim() ||
    phone.trim()       !== initialPhone.trim() ||
    description.trim() !== (initialDescription ?? "").trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim() || !city || !phone.trim()) {
      setError("Name, city and mobile number are required.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("agencies")
      .update({
        name:            name.trim(),
        city,
        address:         address.trim() || null,
        whatsapp_number: phone.trim(),  // DB column is named whatsapp_number for legacy reasons
        description:     description.trim() || null,
      })
      .eq("id", agencyId);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-slate-400 text-xs mb-1 block">Agency name</label>
        <input
          type="text" value={name} onChange={(e) => { setName(e.target.value); setSuccess(false); }}
          required
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">City</label>
        <Select
          value={city}
          onChange={(v) => { setCity(v); setSuccess(false); }}
          options={CITY_OPTIONS}
          placeholder="Select city..."
        />
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">Address</label>
        <input
          type="text" value={address} onChange={(e) => { setAddress(e.target.value); setSuccess(false); }}
          placeholder="No. 12, Main Street, Colombo 3"
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">Mobile number for booking alerts</label>
        <input
          type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSuccess(false); }}
          required
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
        />
        <p className="text-slate-500 text-xs mt-1">Booking alerts arrive here as an SMS — tap the link to confirm in your dashboard.</p>
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">Description</label>
        <textarea
          value={description} onChange={(e) => { setDescription(e.target.value); setSuccess(false); }}
          rows={3} maxLength={500}
          placeholder="Tell renters about your fleet..."
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 resize-none"
        />
        <span className="text-slate-600 text-xs mt-1 block">{description.length}/500</span>
      </div>

      {error   && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">Saved.</p>}

      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}
