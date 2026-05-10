import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const adminAuth = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/admin/users/{id}
// Removes the auth user; profile + bookings cascade via on-delete-cascade.
export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  // Authorize: caller must be a logged-in admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const callerRole = (profileData as { role?: string } | null)?.role;

  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (user.id === id) {
    return NextResponse.json(
      { error: "Cannot delete your own admin account here." },
      { status: 400 }
    );
  }

  const { error } = await adminAuth.auth.admin.deleteUser(id);
  if (error) {
    console.error("[admin user delete]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
