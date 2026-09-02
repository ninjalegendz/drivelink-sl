"use client";

import { useEffect } from "react";
import { trackTrafficEvent } from "@/lib/analytics/client";

export function VehicleViewTracker({ vehicleId, label }: { vehicleId: string; label: string }) {
  useEffect(() => {
    trackTrafficEvent({ event: "vehicle_view", entityType: "vehicle", entityId: vehicleId, label });
  }, [vehicleId, label]);
  return null;
}

