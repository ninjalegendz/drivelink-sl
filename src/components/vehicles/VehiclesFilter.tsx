"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";

const CITY_OPTIONS = [
  { value: "", label: "All cities" },
  ...SL_CITIES.map((c) => ({ value: c, label: c })),
];

const PRICE_OPTIONS = [
  { value: "",      label: "Any price" },
  { value: "3000",  label: "Under Rs. 3,000" },
  { value: "5000",  label: "Under Rs. 5,000" },
  { value: "8000",  label: "Under Rs. 8,000" },
  { value: "12000", label: "Under Rs. 12,000" },
];

interface Props {
  initialQ?:        string;
  initialCity?:     string;
  initialMaxPrice?: string;
}

export function VehiclesFilter({ initialQ = "", initialCity = "", initialMaxPrice = "" }: Props) {
  const router = useRouter();
  const [q, setQ]               = useState(initialQ);
  const [city, setCity]         = useState(initialCity);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);

  const hasFilters = q || city || maxPrice;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q)        params.set("q", q);
    if (city)     params.set("city", city);
    if (maxPrice) params.set("max_price", maxPrice);
    const qs = params.toString();
    router.push(qs ? `/vehicles?${qs}` : "/vehicles");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-8">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Make or model..."
        className="flex-1 min-w-48 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
      />

      <div className="w-44">
        <Select value={city} onChange={setCity} options={CITY_OPTIONS} />
      </div>

      <div className="w-44">
        <Select value={maxPrice} onChange={setMaxPrice} options={PRICE_OPTIONS} />
      </div>

      <button
        type="submit"
        className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors"
      >
        Filter
      </button>

      {hasFilters && (
        <Link href="/vehicles" className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors self-center">
          Clear
        </Link>
      )}
    </form>
  );
}
