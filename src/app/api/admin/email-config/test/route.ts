import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTestEmail } from "@/lib/email/send";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to } = (await req.json().catch(() => ({}))) as { to?: string };
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Provide a valid email address." }, { status: 400 });
  }

  const result = await sendTestEmail(to);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, devOnly: result.devOnly ?? false });
}
