"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

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
      <div>
        <label className="text-slate-400 text-xs mb-1 block">Email</label>
        <input
          type="email" value={email} disabled
          className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-800 rounded-xl text-slate-500 text-sm cursor-not-allowed"
        />
        <p className="text-slate-500 text-xs mt-1">Email changes aren't supported yet — contact support if you need to update yours.</p>
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">Full name</label>
        <input
          type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setSuccess(false); }}
          required
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">WhatsApp number</label>
        <input
          type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSuccess(false); }}
          required
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {error   && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">Saved.</p>}

      <Button type="submit" loading={loading} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}
