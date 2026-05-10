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
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") return { error: "Forbidden", status: 403 as const };

  return { user };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    from_name:     string;
    from_email:    string;
    smtp_host:     string;
    smtp_port:     number;
    smtp_username: string;
    smtp_password: string | null;
  }>;

  const update: Record<string, unknown> = {
    from_name:     body.from_name?.trim()      || "DriveLink SL",
    from_email:    body.from_email?.trim()     || null,
    smtp_host:     body.smtp_host?.trim()      || "smtp.gmail.com",
    smtp_port:     Number(body.smtp_port) || 587,
    smtp_username: body.smtp_username?.trim()  || null,
    updated_by:    auth.user.id,
  };

  // Only overwrite the password if a non-empty value was supplied.
  if (typeof body.smtp_password === "string" && body.smtp_password.length > 0) {
    update.smtp_password = body.smtp_password;
  }

  const service = await createServiceClient();
  const { error } = await service.from("email_config").update(update).eq("id", true);

  if (error) {
    console.error("[email-config save]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
