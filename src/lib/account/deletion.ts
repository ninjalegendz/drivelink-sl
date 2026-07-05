import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { generateUndeleteToken } from "@/lib/account/undelete-token";
import { deleteObject, extractKeyFromUrl } from "@/lib/storage/r2";

// Web Crypto equivalent of node's randomBytes(n).toString("hex").
// Runs on both Node 18+ and the Cloudflare Workers runtime.
function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

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
      message: `You have an in-progress booking (#${b.id.slice(0, 8).toUpperCase()}, ${b.status.replace(/_/g, " ")}). Cancel or complete it first.`,
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
          message: `Your agency has an in-progress booking (#${b.id.slice(0, 8).toUpperCase()}, ${b.status.replace(/_/g, " ")}). Complete or decline it first.`,
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

async function deleteStorageObjectByUrl(publicUrl: string): Promise<void> {
  const key = extractKeyFromUrl(publicUrl);
  if (!key) return;
  try {
    await deleteObject(key);
  } catch (err) {
    console.warn("[deletion] r2 cleanup failed", key, err);
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
      // whatsapp_number is NOT NULL, set to a clearly-invalid marker
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

  // Read what we need BEFORE scrubbing, we need email + name for the
  // confirmation/undelete email.
  const { data: profileRow } = await service
    .from("profiles")
    .select("full_name, email, nic_url, selfie_url, avatar_url, role")
    .eq("id", userId)
    .single();
  const profile = profileRow as {
    full_name: string;
    email: string | null;
    nic_url: string | null;
    selfie_url: string | null;
    avatar_url: string | null;
    role: string;
  } | null;

  if (!profile) return;

  // Build the deletion timestamp + undelete token NOW so the email shows
  // the same `deleted_at` we're about to persist (HMAC binds the two).
  const deletedAt = new Date().toISOString();

  // Send confirmation email BEFORE the scrub wipes the address.
  const realEmail = profile.email && !profile.email.endsWith("@phone.drivelink.invalid")
    ? profile.email
    : null;
  if (realEmail) {
    const token  = await generateUndeleteToken(userId, deletedAt);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk";
    const undeleteUrl = `${appUrl}/api/account/undelete?u=${encodeURIComponent(userId)}&t=${token}`;
    try {
      await sendEmail({
        to:      realEmail,
        subject: "Your DriveLink account was deleted",
        text:    `Hi ${profile.full_name},\n\nYour DriveLink account was just deleted. We've removed your name, contact info, and identity documents from the platform. Booking history remains visible (anonymised) to the agencies / renters you transacted with.\n\nIf you DID delete the account: no action needed.\n\nIf you DIDN'T delete the account, someone may have access to your phone or email. Click the link below within 7 days to restore the account, and then tighten your login security (change your email password, enable 2FA on your email provider, watch for unauthorised access to your phone number):\n\n${undeleteUrl}\n\nLink expires after 7 days.\n\nDriveLink Support`,
        html:    `<p>Hi ${profile.full_name},</p><p>Your DriveLink account was just deleted. We've removed your name, contact info, and identity documents from the platform. Booking history remains visible (anonymised) to the agencies / renters you transacted with.</p><p><strong>If you DID delete the account:</strong> no action needed.</p><p><strong>If you DIDN'T:</strong> someone may have access to your phone or email. Click below within 7 days to restore the account.</p><p><a href="${undeleteUrl}" style="background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Restore my account</a></p><div style="margin-top:20px;padding:12px;background:#fef3c7;border-left:3px solid #f59e0b;color:#92400e;font-size:13px"><strong>⚠ Tighten your account security:</strong><br>• Change your email password and don't reuse it elsewhere<br>• Enable 2FA on your email provider<br>• Watch for unauthorised SIM-swap activity on your phone number<br>• If you suspect compromise, contact us at support@drivelink.lk</div><p style="color:#64748b;font-size:12px;margin-top:20px">Link expires in 7 days. After that the deletion becomes permanent and the account can't be restored.</p>`,
      });
    } catch (err) {
      console.error("[deletion] email send failed (continuing with delete)", err);
    }
  }

  // Storage cleanup, best-effort, before nulling the URLs
  if (profile.nic_url)    await deleteStorageObjectByUrl(profile.nic_url);
  if (profile.selfie_url) await deleteStorageObjectByUrl(profile.selfie_url);
  if (profile.avatar_url) await deleteStorageObjectByUrl(profile.avatar_url);

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
      deleted_at:           deletedAt,
      // PRESERVED on purpose: is_blacklisted, blacklist_reason*,
      // nic_number, rating_avg, rating_count, reliability_pct,
      // kyc_status, phone
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
    password: randomHex(32),
  });
}
