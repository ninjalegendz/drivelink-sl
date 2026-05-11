import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isValidSLPhone, toInternationalSL } from "@/lib/auth/phone-format";
import { softDeleteUser } from "@/lib/account/deletion";

const adminAuth = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

// PATCH /api/admin/users/{id}  body: { full_name?, phone?, email?, role? }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    full_name: string;
    phone:     string;
    email:     string | null;
    role:      "renter" | "agency_owner" | "admin";
  }>;

  const profileUpdate: Record<string, unknown> = {};

  if (typeof body.full_name === "string") {
    if (body.full_name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
    }
    profileUpdate.full_name = body.full_name.trim();
  }

  if (typeof body.phone === "string") {
    if (!isValidSLPhone(body.phone)) {
      return NextResponse.json({ error: "Phone must be a Sri Lankan number like 0771234567." }, { status: 400 });
    }
    profileUpdate.phone = toInternationalSL(body.phone)!;
  }

  if ("email" in body) {
    const trimmed = body.email?.trim().toLowerCase() || null;
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    profileUpdate.email = trimmed;
  }

  if (body.role && ["renter", "agency_owner", "admin"].includes(body.role)) {
    profileUpdate.role = body.role;
  }

  if (Object.keys(profileUpdate).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error: profileError } = await service.from("profiles").update(profileUpdate).eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Keep auth.users.email in sync when we changed it (renter login by email
  // needs the auth row to match).
  if ("email" in body) {
    const targetEmail = (profileUpdate.email as string | null) ?? `${id.replace(/-/g, "")}@phone.drivelink.invalid`;
    const { error: authError } = await adminAuth.auth.admin.updateUserById(id, { email: targetEmail });
    if (authError) {
      console.error("[admin user PATCH] auth update", authError);
      return NextResponse.json({ error: `Profile updated but auth email didn't sync: ${authError.message}` }, { status: 207 });
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/{id}
// Soft-deletes: scrubs PII, removes KYC/avatar storage, scrambles auth
// email + password so login lookup fails. Booking history is preserved
// (the OTHER party still needs to see who they transacted with).
// If the user is an agency owner, their agency is also soft-deleted.
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  if (auth.user.id === id) {
    return NextResponse.json(
      { error: "Cannot delete your own admin account here." },
      { status: 400 }
    );
  }

  // Block admin-on-admin deletion to prevent foot-guns
  const service = await createServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("role, deleted_at")
    .eq("id", id)
    .single();
  const t = target as { role: string; deleted_at: string | null } | null;

  if (!t) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (t.deleted_at) {
    return NextResponse.json({ error: "Account is already deleted." }, { status: 400 });
  }
  if (t.role === "admin") {
    return NextResponse.json(
      { error: "Admins can only be deleted by direct database access." },
      { status: 403 }
    );
  }

  try {
    await softDeleteUser(id);
  } catch (err) {
    console.error("[admin user soft-delete]", err);
    return NextResponse.json({ error: "Soft-delete failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
