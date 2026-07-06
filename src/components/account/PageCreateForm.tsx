"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

type PageType = "personal" | "business";

const inputClass =
  "w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500";

export function PageCreateForm() {
  const router = useRouter();
  const [pageType,      setPageType]      = useState<PageType>("personal");
  const [name,          setName]          = useState("");
  const [city,          setCity]          = useState("");
  const [whatsapp,      setWhatsapp]      = useState("");
  const [description,   setDescription]   = useState("");
  const [businessRegNo, setBusinessRegNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 3) { setError("Name must be at least 3 characters."); return; }
    if (!city)                  { setError("Pick a city."); return; }
    if (!whatsapp.trim())       { setError("Enter a WhatsApp number for booking alerts."); return; }

    setLoading(true);

    const res = await fetch("/api/pages", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:             name.trim(),
        page_type:        pageType,
        city,
        whatsapp_number:  whatsapp.trim(),
        description:      description.trim() || undefined,
        business_reg_no:  pageType === "business" ? (businessRegNo.trim() || undefined) : undefined,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? "Couldn't create the page.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-slate-600 text-xs mb-2 block">Page type</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPageType("personal")}
            className={`spring-press text-left p-4 rounded-2xl border transition-colors ${
              pageType === "personal" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <User size={18} className={pageType === "personal" ? "text-blue-600" : "text-slate-400"} />
            <p className="text-slate-900 font-semibold text-sm mt-2">Personal</p>
            <p className="text-slate-500 text-xs mt-0.5">Rent out your own vehicles</p>
          </button>
          <button
            type="button"
            onClick={() => setPageType("business")}
            className={`spring-press text-left p-4 rounded-2xl border transition-colors ${
              pageType === "business" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <Building2 size={18} className={pageType === "business" ? "text-blue-600" : "text-slate-400"} />
            <p className="text-slate-900 font-semibold text-sm mt-2">Business</p>
            <p className="text-slate-500 text-xs mt-0.5">Registered rental company</p>
          </button>
        </div>
      </div>

      {pageType === "business" && (
        <div>
          <label className="text-slate-600 text-xs mb-1 block">
            Business registration number <span className="text-slate-400 font-normal">(optional for now)</span>
          </label>
          <input
            type="text"
            value={businessRegNo}
            onChange={(e) => setBusinessRegNo(e.target.value)}
            placeholder="e.g. PV 00123456"
            className={inputClass}
          />
          <p className="text-slate-400 text-xs mt-1 flex items-start gap-1.5">
            <Sparkles size={12} className="text-blue-500 mt-0.5 shrink-0" />
            We&apos;ll ask for your registration certificate during admin review before this page goes live.
          </p>
        </div>
      )}

      <div>
        <label className="text-slate-600 text-xs mb-1 block">Page name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder={pageType === "business" ? "e.g. Perera Car Rentals" : "e.g. Kasun's Cars"}
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">City</label>
        <Select value={city} onChange={setCity} options={CITY_OPTIONS} placeholder="Pick a city" />
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">WhatsApp number</label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          required
          autoComplete="tel"
          placeholder="0771234567"
          className={inputClass}
        />
        <p className="text-slate-400 text-xs mt-1">Booking alerts arrive here as an SMS.</p>
      </div>

      <div>
        <label className="text-slate-600 text-xs mb-1 block">
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Tell renters about your vehicles..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Create Rental Page
      </Button>
    </form>
  );
}
