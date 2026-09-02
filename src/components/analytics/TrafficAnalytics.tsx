"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { sendTrafficHeartbeat, trackTrafficEvent } from "@/lib/analytics/client";

export function TrafficAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackTrafficEvent({ event: "page_view", path: pathname });
  }, [pathname]);

  useEffect(() => {
    const timer = window.setInterval(sendTrafficHeartbeat, 90_000);
    const onVisibility = () => sendTrafficHeartbeat();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
