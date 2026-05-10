import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isValidSLPhone, toInternationalSL } from "@/lib/auth/phone-format";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

// PATCH /api/admin/agencies/{id}
// body: { name?, city?, address?, whatsapp_number?, description? }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name:            string;
    city:            string;
    address:         string | null;
    whatsapp_number: string;
    description:     string | null;
  }>;

  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    if (body.name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  if (typeof body.city === "string") {
    if (body.city.trim().length < 2) {
      return NextResponse.json({ error: "City required." }, { status: 400 });
    }
    update.city = body.city.trim();
  }
  if ("address" in body) {
    update.address = body.address?.trim() || null;
  }
  if (typeof body.whatsapp_number === "string") {
    if (!isValidSLPhone(body.whatsapp_number)) {
      return NextResponse.json({ error: "Phone must be a Sri Lankan number like 0771234567." }, { status: 400 });
    }
    update.whatsapp_number = toInternationalSL(body.whatsapp_number)!;
  }
  if ("description" in body) {
    update.description = body.description?.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from("agencies").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
