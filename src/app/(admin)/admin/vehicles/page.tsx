import { createClient } from "@/lib/supabase/server";
import {
  VehicleModerationView, FILTER_TABS,
  type ModerationVehicle, type ModerationVehicleDoc,
} from "@/components/admin/ops/VehicleModerationView";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminVehiclesPage({ searchParams }: Props) {
  const { status: filterParam } = await searchParams;
  // Default to pending_review when no filter is in the URL
  const activeFilter = filterParam ?? FILTER_TABS[0].value;

  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, agencies(name, city, whatsapp_number)")
    .order("created_at", { ascending: false });

  if (activeFilter === "auto") {
    query = query.eq("status", "available").not("auto_published_at", "is", null);
  } else if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data } = await query.limit(60);
  const vehicles = (data ?? []) as unknown as ModerationVehicle[];

  // Document proof (CR / insurance) for the document check, admin-only.
  const ids = vehicles.map((v) => v.id);
  const { data: docRows } = ids.length
    ? await supabase.from("vehicle_documents").select("vehicle_id, cr_url, insurance_url, revenue_license_url").in("vehicle_id", ids)
    : { data: [] };
  const docsByVehicleId: Record<string, ModerationVehicleDoc | undefined> = {};
  for (const d of (docRows ?? []) as { vehicle_id: string; cr_url: string | null; insurance_url: string | null; revenue_license_url: string | null }[]) {
    docsByVehicleId[d.vehicle_id] = { cr_url: d.cr_url, insurance_url: d.insurance_url, revenue_license_url: d.revenue_license_url };
  }

  return <VehicleModerationView vehicles={vehicles} activeFilter={activeFilter} docsByVehicleId={docsByVehicleId} />;
}
