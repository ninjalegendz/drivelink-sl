import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PAGE_COOKIE } from "@/lib/pages/active-page";

// POST /api/pages/switch
// body: { page_id }
//
// Sets the active-page cookie after verifying the caller actually owns
// that page. The cookie is only ever a hint (every read re-validates
// ownership server-side), this just makes the switch stick.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ page_id: string }>;
  const pageId = typeof body.page_id === "string" ? body.page_id.trim() : "";
  if (!pageId) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  const { data: page } = await supabase
    .from("agencies")
    .select("id")
    .eq("id", pageId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PAGE_COOKIE, pageId, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 365,
    secure:   process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
