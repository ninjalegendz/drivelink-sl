import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeletionBlockers, softDeleteUser } from "@/lib/account/deletion";

// GET /api/account/delete, preview blockers without deleting
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const blockers = await getDeletionBlockers(user.id);
  return NextResponse.json({ blockers });
}

// POST /api/account/delete  body: { confirmation: "DELETE" }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { confirmation } = (await req.json().catch(() => ({}))) as { confirmation?: string };
  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const blockers = await getDeletionBlockers(user.id);
  if (blockers.length > 0) {
    return NextResponse.json({ error: "Account has unresolved blockers.", blockers }, { status: 409 });
  }

  await softDeleteUser(user.id);
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
