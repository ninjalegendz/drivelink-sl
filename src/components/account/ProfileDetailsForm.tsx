"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

interface Props {
  userId:           string;
  initialFullName:  string;
  initialPhone:     string;
  email:            string;
}

export function ProfileDetailsForm({ userId, initialFullName, initialPhone, email }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone]       = useState(initialPhone);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [, startTransition]     = useTransition();

  const dirty =
    fullName.trim() !== initialFullName.trim() ||
    phone.trim()    !== initialPhone.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!fullName.trim()) {
      setError("Name can't be empty.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone can't be empty.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone:     phone.trim(),
      })
      .eq("id", userId);

    setLoading(false);

    if (updateError) {
      // Phone has a unique constraint
      if (updateError.message.toLowerCase().includes("duplicate") || updateError.message.toLowerCase().includes("unique")) {
        setError("That phone number is already used by another account.");
      } else {
        setError(updateError.message);
      }
      return;
    }

    setSuccess(true);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Email" hint="Email changes aren't supported yet, contact support if you need to update yours.">
        {(field) => <Input {...field} type="email" value={email} disabled />}
      </Field>

      <Field label="Full name" required>
        {(field) => (
          <Input
            {...field}
            type="text"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setSuccess(false); }}
            required
          />
        )}
      </Field>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-800">Mobile number</label>
        <PhoneInput
          value={phone}
          onChange={(v) => { setPhone(v); setSuccess(false); }}
          required
        />
      </div>

      {error   && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-700">Saved.</p>}

      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}
