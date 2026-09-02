"use client";

import { useRouter } from "next/navigation";

// The fleet page raises its one-off notices from query parameters
// (?photos=2, ?documents=retry, ?authority=owner-review). Those params
// survive a refresh, so the same warning about a save that already happened
// reappeared every time the page was reloaded, with no way to clear it.
// This strips the parameters without adding a history entry.
export function DismissNotice({ to = "/dashboard/vehicles" }: { to?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.replace(to)}
      className="mt-2 block min-h-11 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
    >
      Got it, hide this
    </button>
  );
}
