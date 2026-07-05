"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  bookingId: string;
  collected: boolean;
}

export function InvoiceCollectToggle({ bookingId, collected }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("bookings")
      .update({ agency_fee_collected_at: collected ? null : new Date().toISOString() })
      .eq("id", bookingId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50"
    >
      {loading ? "…" : collected ? "Mark unpaid" : "Mark paid"}
    </button>
  );
}
