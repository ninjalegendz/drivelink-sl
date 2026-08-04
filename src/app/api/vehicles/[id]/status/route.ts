import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canActOnAgency } from "@/lib/pages/access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/vehicles/{id}/status   body: { status: "available" | "unlisted" }
//
// Owner unlist/relist. vehicles.status is a protected column now (service-role
// only), so the owner's Unlist/Relist toggle goes through here. The owner may
// ONLY flip between available and unlisted on a listing that is already in one
// of those states — this deliberately cannot approve a pending_review listing
// (that stays an admin action) or disturb a rented/maintenance vehicle.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ status: string }>;
  if (body.status !== "available" && body.status !== "unlisted") {
    return NextResponse.json({ error: "status must be 'available' or 'unlisted'." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: vehicleRow } = await service
    .from("vehicles")
    .select("id, status, agency_id, agencies(owner_id)")
    .eq("id", id)
    .single();
  const vehicle = vehicleRow as {
    id: string;
    status: string;
    agency_id: string;
    agencies: { owner_id: string } | null;
  } | null;

  if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  if (!(await canActOnAgency(service, user.id, vehicle.agency_id))) {
    return NextResponse.json({ error: "Not your vehicle." }, { status: 403 });
  }
  if (vehicle.status !== "available" && vehicle.status !== "unlisted") {
    return NextResponse.json(
      { error: "Only an approved (available) or unlisted vehicle can be toggled here." },
      { status: 409 },
    );
  }

  const { error } = await service
    .from("vehicles")
    .update({ status: body.status })
    .eq("id", id)
    .in("status", ["available", "unlisted"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: body.status });
}
