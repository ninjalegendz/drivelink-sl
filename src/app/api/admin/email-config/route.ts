import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { invalidateEmailConfigCache } from "@/lib/email/send";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") return { error: "Forbidden", status: 403 as const };

  return { user };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    from_name:       string;
    from_email:      string;
    resend_api_key:  string | null;
  }>;

  const update: Record<string, unknown> = {
    from_name:   body.from_name?.trim()  || "DriveLink SL",
    from_email:  body.from_email?.trim() || null,
    updated_by:  auth.user.id,
  };

  // Only overwrite the API key if a non-empty value was supplied — empty
  // string means "keep the existing key".
  if (typeof body.resend_api_key === "string" && body.resend_api_key.length > 0) {
    update.resend_api_key = body.resend_api_key;
  }

  const service = await createServiceClient();
  const { error } = await service.from("email_config").update(update).eq("id", true);

  if (error) {
    console.error("[email-config save]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The next call to sendEmail() picks up the new config without waiting
  // for the 60s TTL.
  invalidateEmailConfigCache();

  return NextResponse.json({ ok: true });
}
