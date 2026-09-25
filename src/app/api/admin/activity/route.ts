import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countDevLogSince, fetchDevLogPage, parseDevLogFilters } from "@/lib/activity/feed";

// GET /api/admin/activity
//   ?cursor=<ts|id>   next (older) page of the Dev log
//   ?since=<iso>      only a count of events newer than this (the "new
//                     events" notice polls this, so it never ships rows)
//   plus the same filters as the page: category, role, actor, entity, range
//
// Admin only. The admin check here is the fast refusal; row-level security on
// activity_events is what actually limits the rows. Responses are private and
// never stored: the log names people, and a shared cache must not keep it.

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: NO_STORE });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filters = parseDevLogFilters(params);

  try {
    if (params.since) {
      const count = await countDevLogSince(supabase, filters, params.since);
      return NextResponse.json({ count }, { headers: NO_STORE });
    }
    const page = await fetchDevLogPage(supabase, filters, params.cursor ?? null);
    return NextResponse.json(page, { headers: NO_STORE });
  } catch (error) {
    console.error("[dev log]", error);
    return NextResponse.json({ error: "The Dev log could not be loaded." }, { status: 500, headers: NO_STORE });
  }
}
