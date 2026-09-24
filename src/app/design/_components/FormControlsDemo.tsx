"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";

// Select and DatePicker are controlled widgets (not native form elements), so
// showing them live needs somewhere to hold state. Grouping every form
// control demo in one client component keeps that state local to this one
// island rather than making the whole design-system page a client component.

const CITY_OPTIONS: SelectOption[] = [
  { value: "colombo", label: "Colombo" },
  { value: "kandy", label: "Kandy" },
  { value: "galle", label: "Galle" },
  { value: "nuwara-eliya", label: "Nuwara Eliya" },
];

export function FormControlsDemo() {
  const [city, setCity] = useState("colombo");
  const [date, setDate] = useState("2026-10-01");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field label="Full name" hint="As shown on your NIC or passport.">
        {(props) => <Input {...props} placeholder="A. B. Perera" />}
      </Field>

      <Field label="WhatsApp number" error="Enter a valid Sri Lankan mobile number.">
        {(props) => <Input {...props} placeholder="07X XXX XXXX" invalid />}
      </Field>

      <div className="space-y-1.5 sm:col-span-2">
        <Textarea placeholder="e.g. Please include a child seat and a full tank at pickup." aria-label="Notes for the host" />
        <p className="text-xs leading-5 text-slate-500">Textarea, resizes vertically. Optional field, no label chrome needed here.</p>
      </div>

      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-slate-800">City</p>
        <Select value={city} onChange={setCity} options={CITY_OPTIONS} label="City" />
      </div>

      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-slate-800">Pickup date</p>
        <DatePicker value={date} onChange={setDate} label="Pickup date" min="2026-09-24" />
      </div>
    </div>
  );
}
