"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import { Select } from "@/components/ui/Select";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { SL_CITIES } from "@/data/cities";
import { toInternationalSL } from "@/lib/auth/phone-format";
import { containsPublicContactDetails, PUBLIC_CONTACT_ERROR } from "@/lib/content/public-contact";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

type PageType = "personal" | "business";

export interface PageCreateDefaults {
  name: string;
  whatsapp: string;
  email: string;
  /** The account phone already verified with a code, in +94 format. */
  verifiedPhone: string | null;
}

/**
 * Setting up a Rental Page used to be a blank form: name, city, WhatsApp and a
 * required email, followed by a second code for a number the person had just
 * verified at signup. Everything DriveLink already knows is filled in now, the
 * email is optional, and using the verified signup phone skips the second code.
 */
export function PageCreateForm({ defaults }: { defaults?: PageCreateDefaults }) {
  const router = useRouter();
  const [pageType,      setPageType]      = useState<PageType>("personal");
  const [name,          setName]          = useState(defaults?.name ?? "");
  const [city,          setCity]          = useState("");
  const [whatsapp,      setWhatsapp]      = useState(defaults?.whatsapp ?? "");
  const [email,         setEmail]         = useState(defaults?.email ?? "");
  const [description,   setDescription]   = useState("");
  const [businessRegNo, setBusinessRegNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const usesVerifiedPhone = Boolean(
    defaults?.verifiedPhone && toInternationalSL(whatsapp.trim()) === defaults.verifiedPhone,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 3) { setError("Name must be at least 3 characters."); return; }
    if (!city)                  { setError("Pick a city."); return; }
    if (!whatsapp.trim())       { setError("Enter a WhatsApp number for booking alerts."); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email doesn't look right. Fix it or leave it blank."); return;
    }
    if (containsPublicContactDetails(name, description)) {
      setError(PUBLIC_CONTACT_ERROR); return;
    }

    setLoading(true);

    const res = await fetch("/api/pages", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:             name.trim(),
        page_type:        pageType,
        city,
        whatsapp_number:  whatsapp.trim(),
        email:            email.trim() || undefined,
        description:      description.trim() || undefined,
        business_reg_no:  pageType === "business" ? (businessRegNo.trim() || undefined) : undefined,
      }),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(payload.error ?? "Couldn't create the page.");
      return;
    }

    // With the number already verified there is nothing left to do on the
    // dashboard, so go straight to listing the first vehicle. A different
    // number still needs its code, which the dashboard asks for.
    const phoneReady = Boolean((payload.page as { whatsapp_verified_at?: string | null } | undefined)?.whatsapp_verified_at);

    // Stay in the loading state through the navigation: dropping it here left
    // the button idle while the next page was still being fetched.
    startNavigationProgress();
    router.push(phoneReady ? "/dashboard/vehicles/new" : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <span className="text-slate-600 text-sm mb-2 block">Page type</span>
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
        <Field
          label="Business registration number"
          hint="Optional for now. Add your certificate when you are ready to apply for the Verified Business badge."
        >
          {(field) => (
            <Input
              {...field}
              type="text"
              value={businessRegNo}
              onChange={(e) => setBusinessRegNo(e.target.value)}
              placeholder="e.g. PV 00123456"
            />
          )}
        </Field>
      )}

      <Field label="Page name" required hint="Renters see this name. You can change it later.">
        {(field) => (
          <Input
            {...field}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={pageType === "business" ? "e.g. Perera Car Rentals" : "e.g. Kasun's Cars"}
          />
        )}
      </Field>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-800">City</label>
        <Select value={city} onChange={setCity} options={CITY_OPTIONS} placeholder="Pick a city" label="City" />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-800">WhatsApp number</label>
        <PhoneInput value={whatsapp} onChange={setWhatsapp} required />
        {usesVerifiedPhone ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <BadgeCheck size={13} className="shrink-0" aria-hidden="true" />
            You already verified this number, so there is no extra code.
          </p>
        ) : (
          <p className="mt-1.5 text-xs leading-5 text-slate-500">Booking alerts arrive here. A different number gets a one-time code.</p>
        )}
      </div>

      <Field label="Email" hint="Optional. Booking records are also sent here when you add one.">
        {(field) => (
          <Input
            {...field}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field label="Description" hint="Optional">
        {(field) => (
          <Textarea
            {...field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Tell renters about your vehicles..."
          />
        )}
      </Field>

      {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

      <Button type="submit" loading={loading} className="w-full" size="lg">
        {usesVerifiedPhone ? "Create page and list a vehicle" : "Create Rental Page"}
      </Button>
    </form>
  );
}
