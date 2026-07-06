"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SL_CITIES } from "@/data/cities";
import type { RentalPageRow } from "@/types/queries";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

type EditablePage = Pick<
  RentalPageRow,
  | "id" | "name" | "description" | "address" | "city" | "whatsapp_number" | "email" | "business_hours"
  | "sms_notifications_enabled" | "whatsapp_notifications_enabled"
>;

interface Props {
  page: EditablePage;
}

export function PageDetailsForm({ page }: Props) {
  const router = useRouter();
  const [name, setName]                   = useState(page.name);
  const [city, setCity]                   = useState(page.city);
  const [address, setAddress]             = useState(page.address ?? "");
  const [whatsapp, setWhatsapp]           = useState(page.whatsapp_number);
  const [email, setEmail]                 = useState(page.email ?? "");
  const [description, setDescription]     = useState(page.description ?? "");
  const [businessHours, setBusinessHours] = useState(page.business_hours ?? "");
  const [smsAlerts, setSmsAlerts]         = useState(page.sms_notifications_enabled);
  const [waAlerts, setWaAlerts]           = useState(page.whatsapp_notifications_enabled);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [, startTransition]           = useTransition();

  const dirty =
    name.trim()          !== page.name.trim() ||
    city                 !== page.city ||
    address.trim()       !== (page.address ?? "").trim() ||
    whatsapp.trim()       !== page.whatsapp_number.trim() ||
    email.trim()          !== (page.email ?? "").trim() ||
    description.trim()    !== (page.description ?? "").trim() ||
    businessHours.trim()  !== (page.business_hours ?? "").trim() ||
    smsAlerts             !== page.sms_notifications_enabled ||
    waAlerts              !== page.whatsapp_notifications_enabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim() || !city || !whatsapp.trim()) {
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
        whatsapp_number: whatsapp.trim(),  // DB column is named whatsapp_number for legacy reasons
        email:           email.trim() || null,
        description:     description.trim() || null,
        business_hours:  businessHours.trim() || null,
        sms_notifications_enabled:      smsAlerts,
        whatsapp_notifications_enabled: waAlerts,
      })
      .eq("id", page.id);

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
        <label className="text-slate-600 text-xs mb-1 block">Page name</label>
        <input
          type="text" value={name} onChange={(e) => { setName(e.target.value); setSuccess(false); }}
          required
          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">City</label>
        <Select
          value={city}
          onChange={(v) => { setCity(v); setSuccess(false); }}
          options={CITY_OPTIONS}
          placeholder="Select city..."
        />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">Address</label>
        <input
          type="text" value={address} onChange={(e) => { setAddress(e.target.value); setSuccess(false); }}
          placeholder="No. 12, Main Street, Colombo 3"
          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">Mobile number for booking alerts</label>
        <PhoneInput
          value={whatsapp}
          onChange={(v) => { setWhatsapp(v); setSuccess(false); }}
          required
        />
        <p className="text-slate-500 text-xs mt-1">Booking alerts arrive here as an SMS, tap the link to confirm in your dashboard.</p>
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">
          Email <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSuccess(false); }}
          placeholder="you@example.com"
          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">
          Business hours <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text" value={businessHours} onChange={(e) => { setBusinessHours(e.target.value); setSuccess(false); }}
          placeholder="e.g. Mon–Sat, 8am–6pm"
          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">Description</label>
        <textarea
          value={description} onChange={(e) => { setDescription(e.target.value); setSuccess(false); }}
          rows={3} maxLength={500}
          placeholder="Tell renters about your fleet..."
          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
        <span className="text-slate-400 text-xs mt-1 block">{description.length}/500</span>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <p className="text-slate-600 text-xs mb-2 font-medium">Booking alerts for this page</p>
        <label className="flex items-center gap-2 py-1 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={smsAlerts}
            onChange={(e) => { setSmsAlerts(e.target.checked); setSuccess(false); }}
            className="accent-blue-600"
          />
          SMS alerts for new bookings
        </label>
        <label className="flex items-center gap-2 py-1 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={waAlerts}
            onChange={(e) => { setWaAlerts(e.target.checked); setSuccess(false); }}
            className="accent-blue-600"
          />
          WhatsApp alerts for new bookings
        </label>
      </div>

      {error   && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">Saved.</p>}

      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}
