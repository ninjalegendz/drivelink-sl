"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

export default function AgencyOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name:             "",
    city:             "",
    address:          "",
    whatsapp_number:  "",
    description:      "",
  });

  // Pre-fill agency name + WhatsApp from signup metadata
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta      = data.user?.user_metadata ?? {};
      const agencyName = meta.agency_name as string | undefined;
      const phone      = meta.phone as string | undefined;
      setForm((f) => ({
        ...f,
        name:            agencyName ?? f.name,
        whatsapp_number: phone      ?? f.whatsapp_number,
      }));
    });
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) { router.push("/login"); return; }

    const { error: insertError } = await supabase.from("agencies").insert({
      owner_id:        user.id,
      name:            form.name,
      city:            form.city,
      address:         form.address || null,
      whatsapp_number: form.whatsapp_number,
      description:     form.description || null,
    });

    setLoading(false);

    if (insertError) {
      setError("Failed to create agency. Please try again.");
      return;
    }

    router.push("/account?agency=created");
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
      <h1 className="text-white font-bold text-xl mb-1">Set up your agency</h1>
      <p className="text-slate-400 text-sm mb-6">
        This is what renters will see when they browse your vehicles.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Agency / business name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="e.g. Perera Car Rentals"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">City</label>
          <Select
            value={form.city}
            onChange={(v) => set("city", v)}
            options={CITY_OPTIONS}
            placeholder="Select city..."
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">WhatsApp number (for booking alerts)</label>
          <input
            type="tel"
            value={form.whatsapp_number}
            onChange={(e) => set("whatsapp_number", e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="+94 77 123 4567"
          />
          <p className="text-slate-500 text-xs mt-1">
            Booking requests arrive here. Reply YES or NO to confirm.
          </p>
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">Address (optional)</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="No. 12, Main Street, Colombo 3"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 resize-none"
            placeholder="Tell renters about your fleet..."
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          <span className="inline-flex items-center gap-1.5">Create agency profile <ArrowRight size={16} /></span>
        </Button>
      </form>
    </div>
  );
}
