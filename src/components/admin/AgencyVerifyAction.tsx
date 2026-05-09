"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function AgencyVerifyAction({ agencyId, isVerified }: { agencyId: string; isVerified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("agencies").update({ is_verified: !isVerified }).eq("id", agencyId);
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      size="sm"
      variant={isVerified ? "secondary" : "primary"}
      loading={loading}
      onClick={toggle}
      className="shrink-0"
    >
      {isVerified ? "Revoke verification" : "Verify agency"}
    </Button>
  );
}
