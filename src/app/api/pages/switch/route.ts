import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PAGE_COOKIE } from "@/lib/pages/active-page";
import { canActOnAgency } from "@/lib/pages/access";

// POST /api/pages/switch
// body: { page_id }
//
// Sets the active-page cookie after verifying the caller can actually operate
// that page (owns it, or is a staff member of it). The cookie is only ever a
// hint (every read re-validates server-side), this just makes the switch stick.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ page_id: string }>;
  const pageId = typeof body.page_id === "string" ? body.page_id.trim() : "";
  if (!pageId) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  if (!(await canActOnAgency(supabase, user.id, pageId))) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }

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
