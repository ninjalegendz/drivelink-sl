"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function KycActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function update(status: "verified" | "rejected") {
    setLoading(status === "verified" ? "approve" : "reject");
    const supabase = createClient();
    await supabase.from("profiles").update({ kyc_status: status }).eq("id", userId);
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button size="sm" loading={loading === "approve"} onClick={() => update("verified")}>
        ✓ Approve
      </Button>
      <Button size="sm" variant="danger" loading={loading === "reject"} onClick={() => update("rejected")}>
        ✗ Reject
      </Button>
    </div>
  );
}
