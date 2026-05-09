import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDiditSession } from "@/lib/didit/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const redirectPath: string = body.redirectPath ?? "/account?didit=done";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const session = await createDiditSession({
      userId: user.id,
      redirectUrl: `${appUrl}${redirectPath}`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Didit start]", err);
    return NextResponse.json({ error: "Failed to create verification session" }, { status: 500 });
  }
}
