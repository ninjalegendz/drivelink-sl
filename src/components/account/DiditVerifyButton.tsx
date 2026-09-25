"use client";

import { useState } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
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
      <div className="flex items-center gap-3 rounded-xl bg-blue-50/70 p-3.5 ring-1 ring-inset ring-blue-100">
        {/* Didit logo placeholder, replace with <img> if you have their logo asset */}
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 ring-1 ring-inset ring-blue-100">
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-slate-900">Powered by Didit</p>
          <p className="text-xs leading-5 text-slate-600">
            Didit checks your ID and a quick selfie. DriveLink keeps only a protected copy of the approved ID for handover, never shown publicly.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-rose-700">
          <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button onClick={start} loading={loading} size="lg" block>
        {label}
      </Button>
    </div>
  );
}
