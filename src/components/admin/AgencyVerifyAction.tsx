"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function AgencyVerifyAction({ agencyId, isVerified }: { agencyId: string; isVerified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/admin/agencies/${agencyId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_verified: !isVerified }),
    });
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
      {isVerified ? "Revoke verification" : "Verify page"}
    </Button>
  );
}
