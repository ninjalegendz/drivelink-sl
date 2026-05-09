"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  redirectPath?: string;
  label?: string;
}

export function DiditVerifyButton({
  redirectPath = "/account?didit=done",
  label = "Verify my identity with Didit",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/didit/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirectPath }),
    });

    if (!res.ok) {
      setError("Could not start verification. Please try again.");
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
        {/* Didit logo placeholder — replace with <img> if you have their logo asset */}
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
          D
        </div>
        <div className="text-sm">
          <p className="text-white font-medium">Powered by Didit</p>
          <p className="text-slate-400 text-xs">
            Secure biometric ID verification — your documents are processed by Didit, not stored by DriveLink.
          </p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button onClick={start} loading={loading} className="w-full">
        {label}
      </Button>
    </div>
  );
}
