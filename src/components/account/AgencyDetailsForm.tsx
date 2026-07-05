"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

interface Props {
  agencyId:                 string;
  initialName:              string;
  initialCity:              string;
  initialAddress:           string | null;
  initialPhone:             string;
  initialDescription:       string | null;
  initialSmsEnabled:        boolean;
  initialWhatsappEnabled:   boolean;
}

export function AgencyDetailsForm({
  agencyId,
  initialName,
  initialCity,
  initialAddress,
  initialPhone,
  initialDescription,
  initialSmsEnabled,
  initialWhatsappEnabled,
}: Props) {
  const router = useRouter();
  const [name, setName]               = useState(initialName);
  const [city, setCity]               = useState(initialCity);
  const [address, setAddress]         = useState(initialAddress ?? "");
  const [phone, setPhone]             = useState(initialPhone);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [smsEnabled, setSmsEnabled]           = useState(initialSmsEnabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(initialWhatsappEnabled);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [, startTransition]           = useTransition();

  const dirty =
    name.trim()        !== initialName.trim() ||
    city               !== initialCity ||
    address.trim()     !== (initialAddress ?? "").trim() ||
    phone.trim()       !== initialPhone.trim() ||
    description.trim() !== (initialDescription ?? "").trim() ||
    smsEnabled         !== initialSmsEnabled ||
    whatsappEnabled    !== initialWhatsappEnabled;

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
        sms_notifications_enabled:      smsEnabled,
        whatsapp_notifications_enabled: whatsappEnabled,
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
        <label className="text-slate-600 text-xs mb-1 block">Agency name</label>
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
        <input
          type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSuccess(false); }}
          required
          className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500"
        />
        <p className="text-slate-500 text-xs mt-1">Booking alerts arrive here as an SMS, tap the link to confirm in your dashboard.</p>
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

      <div className="pt-2 border-t border-slate-100">
        <p className="text-slate-700 text-sm font-medium mb-1">Booking-request notifications</p>
        <p className="text-slate-500 text-xs mb-3">
          Pick which channels we use to alert you when a renter requests one of your vehicles.
          The realtime dashboard toast fires regardless.
        </p>

        <label className="flex items-start gap-3 cursor-pointer py-2">
          <input
            type="checkbox"
            checked={smsEnabled}
            onChange={(e) => { setSmsEnabled(e.target.checked); setSuccess(false); }}
            className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <span className="flex-1">
            <span className="block text-slate-900 text-sm">SMS alerts</span>
            <span className="block text-slate-500 text-xs">
              Text message to your mobile number with a confirm-link to the dashboard. Most reliable channel.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer py-2">
          <input
            type="checkbox"
            checked={whatsappEnabled}
            onChange={(e) => { setWhatsappEnabled(e.target.checked); setSuccess(false); }}
            className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <span className="flex-1">
            <span className="block text-slate-900 text-sm">WhatsApp alerts</span>
            <span className="block text-slate-500 text-xs">
              WhatsApp Business template message to the same number. Turn off if duplicate or annoying.
            </span>
          </span>
        </label>

        {!smsEnabled && !whatsappEnabled && (
          <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-800 text-xs leading-relaxed">
              Both alerts are off, you&apos;ll only see new bookings when you open your dashboard, with no phone
              alert. Keep at least one on so you don&apos;t miss time-sensitive requests.
            </p>
          </div>
        )}
      </div>

      {error   && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">Saved.</p>}

      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}
