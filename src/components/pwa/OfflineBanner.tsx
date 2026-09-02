"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// DriveLink is used at the roadside on mobile data, and until now nothing in
// the product knew the difference between "the server refused this" and "you
// have no signal". Both produced the same failure message, which sends people
// looking for a fault that isn't there.
//
// Sits above the fixed bottom navigation so it never covers the tab bar.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full border border-amber-300 bg-amber-50 px-4 py-2 shadow-lg md:bottom-4"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <WifiOff size={15} className="shrink-0" aria-hidden="true" />
        You are offline. Anything you have typed is kept until you reconnect.
      </p>
    </div>
  );
}
