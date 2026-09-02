export type TrafficRangeKey = "24h" | "7d" | "30d" | "90d";

export interface TrafficSnapshot {
  active_now: number;
  signed_in_now: number;
  visitors: number;
  page_views: number;
  vehicle_views: number;
  booking_starts: number;
  booking_requests: number;
  guide_plays: number;
  sources: Array<{ source: string; visitors: number }>;
  devices: Array<{ device: string; visitors: number }>;
  top_paths: Array<{ path: string; views: number; visitors: number }>;
  top_vehicles: Array<{ id: string; label: string | null; views: number; visitors: number }>;
  daily: Array<{ day: string; views: number; visitors: number }>;
  recent: Array<{
    id: number;
    visitor: string;
    signed_in: boolean;
    event_name: string;
    path: string;
    entity_type: string | null;
    entity_id: string | null;
    label: string | null;
    source: string;
    device: string;
    created_at: string;
  }>;
}

export function trafficRangeStart(key: TrafficRangeKey): string {
  const hours = key === "24h" ? 24 : key === "7d" ? 24 * 7 : key === "30d" ? 24 * 30 : 24 * 90;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export const EMPTY_TRAFFIC_SNAPSHOT: TrafficSnapshot = {
  active_now: 0,
  signed_in_now: 0,
  visitors: 0,
  page_views: 0,
  vehicle_views: 0,
  booking_starts: 0,
  booking_requests: 0,
  guide_plays: 0,
  sources: [],
  devices: [],
  top_paths: [],
  top_vehicles: [],
  daily: [],
  recent: [],
};

