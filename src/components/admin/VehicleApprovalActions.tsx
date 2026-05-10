"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  vehicleId: string;
}

export function VehicleApprovalActions({ vehicleId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function update(status: "available" | "unlisted") {
    setLoading(status === "available" ? "approve" : "reject");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("vehicles")
      .update({ status })
      .eq("id", vehicleId);

    setLoading(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 shrink-0">
        <Button size="sm" loading={loading === "approve"} onClick={() => update("available")}>
          <Check size={14} /> Approve
        </Button>
        <Button size="sm" variant="danger" loading={loading === "reject"} onClick={() => update("unlisted")}>
          <X size={14} /> Reject
        </Button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
