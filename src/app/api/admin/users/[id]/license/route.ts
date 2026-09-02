import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return { user };
}

function isDateOnly(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// PATCH /api/admin/users/{id}/license
// body: { status: "verified" | "rejected", note? }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as Partial<{ status: "verified" | "rejected"; note: string }>;
  if (body.status !== "verified" && body.status !== "rejected") {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (body.status === "rejected" && !note) {
    return NextResponse.json({ error: "Tell the renter what needs to be corrected." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const service = await createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("id, phone, email, license_front_url, license_back_url, date_of_birth, license_issued_on, license_expires_on, license_jurisdiction, license_review_status")
    .eq("id", id)
    .maybeSingle();
  const profile = data as {
    id: string;
    phone: string | null;
    email: string | null;
    license_front_url: string | null;
    license_back_url: string | null;
    date_of_birth: string | null;
    license_issued_on: string | null;
    license_expires_on: string | null;
    license_jurisdiction: string | null;
    license_review_status: string | null;
  } | null;
  if (!profile) return NextResponse.json({ error: "Renter not found." }, { status: 404 });
  if (body.status === "verified") {
    const complete = Boolean(
      profile.license_front_url
      && profile.license_back_url
      && isDateOnly(profile.date_of_birth)
      && isDateOnly(profile.license_issued_on)
      && isDateOnly(profile.license_expires_on)
      && ["sri_lanka", "foreign"].includes(profile.license_jurisdiction ?? ""),
    );
    if (!complete) return NextResponse.json({ error: "This licence submission is incomplete." }, { status: 409 });
    if ((profile.license_expires_on as string) < new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ error: "This licence is already expired." }, { status: 409 });
    }
    if ((profile.license_issued_on as string) < (profile.date_of_birth as string) || (profile.license_expires_on as string) < (profile.license_issued_on as string)) {
      return NextResponse.json({ error: "The licence dates are not in a valid order." }, { status: 409 });
    }
  }

  const reviewedAt = new Date().toISOString();
  const { error } = await service.from("profiles").update({
    license_review_status: body.status,
    license_reviewed_at: reviewedAt,
    license_reviewed_by: auth.user.id,
    license_review_note: body.status === "rejected" ? note : null,
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the licence review." }, { status: 500 });

  await logEvent(service, {
    actorId: auth.user.id,
    actorRole: "admin",
    eventType: `admin.license_${body.status}`,
    subjectKind: "renter",
    subjectId: id,
    relatedRenterId: id,
  });
  await enqueueNotification(service, {
    eventKey: `license-review:${id}:${reviewedAt}`,
    recipientKind: "renter",
    phone: profile.phone,
    email: profile.email,
    smsKey: "booking_status_renter",
    text: body.status === "verified"
      ? "DriveLink: your driving licence has been reviewed. You can now request eligible self-drive rentals: https://drivelink.lk/account"
      : `DriveLink: your driving-licence submission needs an update. ${note} Update it here: https://drivelink.lk/account`,
    emailSubject: body.status === "verified" ? "Driving licence reviewed" : "Update your driving licence",
  });
  kickNotificationOutbox(service);

  return NextResponse.json({ ok: true });
}
