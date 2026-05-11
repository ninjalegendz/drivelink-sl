import { createClient as createPlainClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export interface DeletionBlocker {
  type:     "active_booking" | "unpaid_fees" | "is_admin";
  message:  string;
  fix_url?: string;
}

const ACTIVE_BOOKING_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "payment_pending",
  "active",
] as const;

/**
 * Returns a list of reasons the account can't be deleted right now.
 * Empty array = good to delete.
 */
export async function getDeletionBlockers(userId: string): Promise<DeletionBlocker[]> {
  const service = await createServiceClient();
  const blockers: DeletionBlocker[] = [];

  const { data: profileRow } = await service
    .from("profiles")
    .select("role, deleted_at")
    .eq("id", userId)
    .single();
  const profile = profileRow as { role: string; deleted_at: string | null } | null;

  if (!profile) return blockers;

  if (profile.deleted_at) {
    blockers.push({ type: "is_admin", message: "Account is already deleted." });
    return blockers;
  }

  if (profile.role === "admin") {
    blockers.push({
      type:    "is_admin",
      message: "Admins can't self-delete. Ask another admin to delete this account from the admin panel.",
    });
    return blockers;
  }

  // Active bookings as renter
  const { data: renterBookings } = await service
    .from("bookings")
    .select("id, status")
    .eq("renter_id", userId)
    .in("status", ACTIVE_BOOKING_STATUSES as unknown as string[]);

  for (const b of (renterBookings ?? []) as { id: string; status: string }[]) {
    blockers.push({
      type:    "active_booking",
      message: `You have an in-progress booking (#${b.id.slice(0, 8).toUpperCase()} — ${b.status.replace(/_/g, " ")}). Cancel or complete it first.`,
      fix_url: `/bookings/${b.id}`,
    });
  }

  // Agency-owner checks
  if (profile.role === "agency_owner") {
    const { data: agencyRow } = await service
      .from("agencies")
      .select("id")
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    const agencyId = (agencyRow as { id: string } | null)?.id;

    if (agencyId) {
      const { data: agencyBookings } = await service
        .from("bookings")
        .select("id, status")
        .eq("agency_id", agencyId)
        .in("status", ACTIVE_BOOKING_STATUSES as unknown as string[]);

      for (const b of (agencyBookings ?? []) as { id: string; status: string }[]) {
        blockers.push({
          type:    "active_booking",
          message: `Your agency has an in-progress booking (#${b.id.slice(0, 8).toUpperCase()} — ${b.status.replace(/_/g, " ")}). Complete or decline it first.`,
          fix_url: "/dashboard/bookings",
        });
      }

      const { data: feeRows } = await service
        .from("bookings")
        .select("agency_fee_lkr")
        .eq("agency_id", agencyId)
        .eq("status", "completed")
        .is("agency_fee_collected_at", null);

      const totalOwed = ((feeRows ?? []) as { agency_fee_lkr: number }[])
        .reduce((s, r) => s + r.agency_fee_lkr, 0);

      if (totalOwed > 0) {
        blockers.push({
          type:    "unpaid_fees",
          message: `Outstanding platform fees: Rs. ${totalOwed.toLocaleString("en-LK")}. Settle with DriveLink before closing the account.`,
          fix_url: "/dashboard",
        });
      }
    }
  }

  return blockers;
}

async function deleteStorageObjectByUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  bucket: string,
  publicUrl: string
): Promise<void> {
  // URLs look like https://.../storage/v1/object/public/<bucket>/<path>
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  if (!path) return;
  try {
    await service.storage.from(bucket).remove([path]);
  } catch (err) {
    console.warn("[deletion] storage cleanup failed", bucket, path, err);
  }
}

/**
 * Soft-deletes the agency: name + identifying fields scrubbed,
 * vehicles unlisted, deleted_at stamped. Does NOT delete the row.
 */
export async function softDeleteAgency(agencyId: string): Promise<void> {
  const service = await createServiceClient();
  const shortId = agencyId.slice(0, 8).toUpperCase();

  await service
    .from("agencies")
    .update({
      name:            `Former agency #${shortId}`,
      description:     null,
      address:         null,
      // whatsapp_number is NOT NULL — set to a clearly-invalid marker
      whatsapp_number: `deleted-${shortId}`,
      is_blocked:      true,
      deleted_at:      new Date().toISOString(),
    })
    .eq("id", agencyId);

  // Hide all of their vehicles
  await service
    .from("vehicles")
    .update({ status: "unlisted" })
    .eq("agency_id", agencyId);
}

/**
 * Soft-deletes the user: PII scrubbed, KYC/avatar storage files
 * removed, auth.users email + password scrambled so passwordless OTP
 * lookup fails. The auth.users row itself is kept (deleting it would
 * cascade-delete the profile via FK). If the user owns an agency,
 * that gets soft-deleted too.
 */
export async function softDeleteUser(userId: string): Promise<void> {
  const service = await createServiceClient();
  const shortId = userId.slice(0, 8).toUpperCase();

  // Read what we need before scrubbing
  const { data: profileRow } = await service
    .from("profiles")
    .select("nic_url, selfie_url, avatar_url, role")
    .eq("id", userId)
    .single();
  const profile = profileRow as {
    nic_url: string | null;
    selfie_url: string | null;
    avatar_url: string | null;
    role: string;
  } | null;

  if (!profile) return;

  // Storage cleanup — best-effort
  if (profile.nic_url)    await deleteStorageObjectByUrl(service, "kyc",     profile.nic_url);
  if (profile.selfie_url) await deleteStorageObjectByUrl(service, "kyc",     profile.selfie_url);
  if (profile.avatar_url) await deleteStorageObjectByUrl(service, "avatars", profile.avatar_url);

  // Scrub profile
  await service
    .from("profiles")
    .update({
      full_name:            `Deleted user #${shortId}`,
      email:                null,
      email_verified_at:    null,
      nic_url:              null,
      selfie_url:           null,
      avatar_url:           null,
      didit_session_id:     null,
      phone_otp_hash:       null,
      phone_otp_expires_at: null,
      phone_otp_attempts:   0,
      phone_otp_send_count: 0,
      deleted_at:           new Date().toISOString(),
      // PRESERVED on purpose: is_blacklisted, blacklist_reason*,
      // rating_avg, rating_count, reliability_pct, kyc_status, phone
    })
    .eq("id", userId);

  // If they're an agency owner, soft-delete their agency too
  if (profile.role === "agency_owner") {
    const { data: agencyRow } = await service
      .from("agencies")
      .select("id")
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    const agencyId = (agencyRow as { id: string } | null)?.id;
    if (agencyId) await softDeleteAgency(agencyId);
  }

  // Scramble auth.users.email + password so login lookup fails entirely
  const admin = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await admin.auth.admin.updateUserById(userId, {
    email:    `deleted+${userId.replace(/-/g, "")}@drivelink.invalid`,
    password: randomBytes(32).toString("hex"),
  });
}
