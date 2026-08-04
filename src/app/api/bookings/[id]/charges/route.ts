import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CHARGE_KINDS, type ChargeKind } from "@/lib/booking/settlement";
import { canActOnAgency } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

// GET /api/bookings/{id}/charges — either party lists the ledger.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // RLS ("Booking parties read charges") scopes the rows to this booking's parties.
  const { data, error } = await supabase
    .from("booking_charges")
    .select("id, kind, label, amount_lkr, created_at")
    .eq("booking_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Couldn't load charges." }, { status: 500 });
  return NextResponse.json({ ok: true, charges: data ?? [] });
}

// POST /api/bookings/{id}/charges — the OWNER adds a settlement line item.
// body: { kind, label?, amount_lkr }
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ kind: string; label: string; amount_lkr: number }>;
  if (!body.kind || !CHARGE_KINDS.includes(body.kind as ChargeKind)) {
    return NextResponse.json({ error: "Invalid charge type." }, { status: 400 });
  }
  const amount = Math.round(Number(body.amount_lkr));
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, status, settlement_ack_at, agency_id, agencies!inner(owner_id)")
    .eq("id", id)
    .single();
  const bk = bookingRow as { status: string; settlement_ack_at: string | null; agency_id: string; agencies: { owner_id: string } | null } | null;
  if (!bk) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!(await canActOnAgency(service, user.id, bk.agency_id))) return NextResponse.json({ error: "Only the Rental Page can add charges." }, { status: 403 });
  if (!["active", "completed", "disputed"].includes(bk.status)) {
    return NextResponse.json({ error: "Charges can only be added around return." }, { status: 409 });
  }
  if (bk.settlement_ack_at) {
    return NextResponse.json({ error: "The renter has already accepted this settlement — it's locked." }, { status: 409 });
  }

  const { data: inserted, error } = await service
    .from("booking_charges")
    .insert({ booking_id: id, kind: body.kind, label: body.label?.trim() || null, amount_lkr: amount, created_by: user.id })
    .select("id, kind, label, amount_lkr, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, charge: inserted });
}
