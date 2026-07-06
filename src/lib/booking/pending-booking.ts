// A booking a renter tried to send before verifying their identity. Stashed
// in localStorage while they go through Didit (which redirects away), then
// restored on the vehicle page when they return so their dates aren't lost.
export interface PendingBooking {
  vehicleId: string;
  agencyId:  string;
  startDate: string;
  endDate:   string;
  startTime: string;
  endTime:   string;
}

const KEY = "dl_pending_booking";

export function stashPendingBooking(d: PendingBooking): void {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode, ignore */ }
}

export function readPendingBooking(): PendingBooking | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingBooking) : null;
  } catch {
    return null;
  }
}

export function clearPendingBooking(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Stash the draft, then hand off to Didit, returning to `returnPath`. */
export async function startVerificationForBooking(
  draft: PendingBooking,
  returnPath: string,
): Promise<{ ok: boolean; error?: string }> {
  stashPendingBooking(draft);
  try {
    const res = await fetch("/api/didit/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ redirectPath: `${returnPath}?verified=1` }),
    });
    if (!res.ok) return { ok: false, error: "Couldn't start verification. Please try again." };
    const { url } = await res.json();
    window.location.href = url;
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't start verification. Please try again." };
  }
}
