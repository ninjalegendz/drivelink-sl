"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { SL_CITIES } from "@/data/cities";
import { containsPublicContactDetails, PUBLIC_CONTACT_ERROR } from "@/lib/content/public-contact";
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
  const [whatsapp, setWhatsapp]           = useState(page.whatsapp_number ?? "");
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
    whatsapp.trim()       !== (page.whatsapp_number ?? "").trim() ||
    email.trim()          !== (page.email ?? "").trim() ||
    description.trim()    !== (page.description ?? "").trim() ||
    businessHours.trim()  !== (page.business_hours ?? "").trim() ||
    smsAlerts             !== page.sms_notifications_enabled ||
    waAlerts              !== page.whatsapp_notifications_enabled;
  const phoneChanged = whatsapp.trim() !== (page.whatsapp_number ?? "").trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim() || !city || !whatsapp.trim()) {
      setError("Name, city and mobile number are required.");
      return;
    }
    if (containsPublicContactDetails(name, description, businessHours)) {
      setError(PUBLIC_CONTACT_ERROR);
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
      <Field label="Page name" required>
        {(field) => (
          <Input {...field} type="text" value={name} onChange={(e) => { setName(e.target.value); setSuccess(false); }} required />
        )}
      </Field>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-800">City</label>
        <Select
          value={city}
          onChange={(v) => { setCity(v); setSuccess(false); }}
          options={CITY_OPTIONS}
          placeholder="Select city..."
          label="City"
        />
      </div>

      <Field label="Address" hint="Optional">
        {(field) => (
          <Input
            {...field}
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSuccess(false); }}
            placeholder="No. 12, Main Street, Colombo 3"
          />
        )}
      </Field>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-800">Mobile number for booking alerts</label>
        <PhoneInput
          value={whatsapp}
          onChange={(v) => { setWhatsapp(v); setSuccess(false); }}
          required
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500">Booking alerts arrive here as an SMS, tap the link to confirm in your dashboard.</p>
        {phoneChanged && <p className="mt-1 text-xs font-medium text-amber-700">Saving a new number means you will need to verify it again.</p>}
      </div>

      <Field label="Email" hint="Optional">
        {(field) => (
          <Input
            {...field}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSuccess(false); }}
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field label="Business hours" hint="Optional, e.g. Mon-Sat, 8am-6pm">
        {(field) => (
          <Input
            {...field}
            type="text"
            value={businessHours}
            onChange={(e) => { setBusinessHours(e.target.value); setSuccess(false); }}
            placeholder="e.g. Mon-Sat, 8am-6pm"
          />
        )}
      </Field>

      <Field label="Description" hint={`${description.length}/500`}>
        {(field) => (
          <Textarea
            {...field}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSuccess(false); }}
            rows={3}
            maxLength={500}
            placeholder="Tell renters about your fleet..."
          />
        )}
      </Field>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">Booking alerts for this page</p>
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={smsAlerts}
            onChange={(e) => { setSmsAlerts(e.target.checked); setSuccess(false); }}
            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
          />
          SMS alerts for new bookings
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={waAlerts}
            onChange={(e) => { setWaAlerts(e.target.checked); setSuccess(false); }}
            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
          />
          WhatsApp alerts for new bookings
        </label>
      </div>

      {error   && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{phoneChanged ? "Saved. Verify the new number below." : "Saved."}</p>}

      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}
