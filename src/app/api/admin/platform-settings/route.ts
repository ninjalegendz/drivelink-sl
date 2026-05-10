import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    bank_account_name:   string;
    bank_name:           string;
    bank_account_number: string;
    bank_branch:         string | null;
  }>;

  const update: Record<string, unknown> = { updated_by: auth.user.id };
  if (typeof body.bank_account_name   === "string") update.bank_account_name   = body.bank_account_name.trim()   || "DriveLink SL";
  if (typeof body.bank_name           === "string") update.bank_name           = body.bank_name.trim()           || "Commercial Bank";
  if (typeof body.bank_account_number === "string") update.bank_account_number = body.bank_account_number.trim();
  if ("bank_branch" in body)                        update.bank_branch         = body.bank_branch?.trim() || null;

  if (!update.bank_account_number) {
    return NextResponse.json({ error: "Account number is required." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from("platform_settings").update(update).eq("id", true);
  if (error) {
    console.error("[platform-settings save]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
