"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Signing out is a network round trip followed by a full navigation. With no
  // busy state the button sat there looking untouched, so people pressed it
  // again mid-flight.
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      startNavigationProgress();
      router.push("/");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 transition-colors hover:text-rose-600 disabled:opacity-60"
    >
      {signingOut && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
        />
      )}
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
