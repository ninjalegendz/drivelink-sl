"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function BlacklistActions({ reportId, reportedNic }: { reportId: string; reportedNic: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "dismiss" | null>(null);

  async function approve() {
    setLoading("approve");
    const supabase = createClient();

    // Mark report approved
    await supabase.from("blacklist_reports").update({
      approved: true,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reportId);

    // Blacklist all profiles matching this NIC
    await supabase.from("profiles").update({
      is_blacklisted: true,
      blacklist_reason: `NIC ${reportedNic} flagged for vehicle damage/theft.`,
    }).ilike("nic_url", `%${reportedNic}%`);

    setLoading(null);
    router.refresh();
  }

  async function dismiss() {
    setLoading("dismiss");
    const supabase = createClient();
    await supabase.from("blacklist_reports").update({
      approved: false,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reportId);
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button size="sm" variant="danger" loading={loading === "approve"} onClick={approve}>
        Blacklist NIC
      </Button>
      <Button size="sm" variant="secondary" loading={loading === "dismiss"} onClick={dismiss}>
        Dismiss
      </Button>
    </div>
  );
}
