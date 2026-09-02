import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { EMPTY_TRAFFIC_SNAPSHOT, trafficRangeStart, type TrafficRangeKey, type TrafficSnapshot } from "@/lib/analytics/traffic";

const RANGES = new Set<TrafficRangeKey>(["24h", "7d", "30d", "90d"]);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Sign in required" : "Forbidden" }, { status: auth.status });

  const requested = req.nextUrl.searchParams.get("range") as TrafficRangeKey | null;
  const range = requested && RANGES.has(requested) ? requested : "30d";
  const service = await createServiceClient();
  const { data, error } = await service.rpc("traffic_analytics_snapshot", { p_since: trafficRangeStart(range) });
  if (error) {
    console.error("[admin traffic analytics] snapshot failed", error.message);
    return NextResponse.json({ snapshot: EMPTY_TRAFFIC_SNAPSHOT, error: "Traffic data is temporarily unavailable." }, { status: 503 });
  }

  return NextResponse.json({ snapshot: (data ?? EMPTY_TRAFFIC_SNAPSHOT) as TrafficSnapshot });
}

