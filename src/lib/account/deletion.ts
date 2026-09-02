import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getOwnedPages } from "@/lib/pages/active-page";
import { sendEmail } from "@/lib/email/send";
import { generateUndeleteToken } from "@/lib/account/undelete-token";

export class RecoveryEmailDeliveryError extends Error {
  constructor() {
    super("The recovery email could not be sent.");
    this.name = "RecoveryEmailDeliveryError";
  }
}
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
  type:     "active_booking" | "is_admin";
  message:  string;
  fix_url?: string;
}

const ACTIVE_BOOKING_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "payment_pending",
  "active",
  // PRIV-001: an open dispute must block deletion - a party can't scrub their
  // identity/evidence mid-investigation. (An overdue rental is still 'active',
  // already covered above.)
  "disputed",
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

  // Check ownership directly. A stale profile role must never let an owner
  // delete the account while any of their pages has an unresolved booking.
  const ownedPages = await getOwnedPages(service, userId);

  for (const p of ownedPages) {
      const { data: agencyBookings } = await service
        .from("bookings")
        .select("id, status")
        .eq("agency_id", p.id)
        .in("status", ACTIVE_BOOKING_STATUSES as unknown as string[]);

      for (const b of (agencyBookings ?? []) as { id: string; status: string }[]) {
        blockers.push({
          type:    "active_booking",
          message: `Your Rental Page "${p.name}" has an in-progress booking (#${b.id.slice(0, 8).toUpperCase()}, ${b.status.replace(/_/g, " ")}). Complete or decline it first.`,
          fix_url: "/dashboard/bookings",
        });
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
export async function softDeleteAgency(agencyId: string, source: "account" | "admin" = "admin"): Promise<void> {
  const service = await createServiceClient();
  const { data: pageRow, error: pageError } = await service
    .from("agencies")
    .select("deleted_at, logo_url, cover_url, business_reg_url")
    .eq("id", agencyId)
    .maybeSingle();
  if (pageError) throw new Error(`Could not read Rental Page before deletion: ${pageError.message}`);
  if (!pageRow) throw new Error("Rental Page not found.");

  const { error: deleteError } = await service.rpc("soft_delete_rental_page", {
    p_agency_id: agencyId,
    p_source: source,
  });
  if (deleteError) throw new Error(`Could not delete Rental Page: ${deleteError.message}`);

  const assets = pageRow as {
    deleted_at: string | null;
    logo_url: string | null;
    cover_url: string | null;
    business_reg_url: string | null;
  };
  for (const url of [assets.logo_url, assets.cover_url, assets.business_reg_url]) {
    if (url) await deleteStorageObjectByUrl(url);
  }
}

/**
 * Restores the user's soft-deleted Rental Pages after an account
 * undelete. Only pages deleted as part of that account deletion qualify;
 * an admin-deleted page is never revived by this link. Identifying fields
 * cannot be recovered, and any earlier suspension remains in force.
 */
export async function restoreOwnedPages(userId: string): Promise<void> {
  const service = await createServiceClient();

  const { data: pages } = await service
    .from("agencies")
    .select("id, blocked_before_deletion")
    .eq("owner_id", userId)
    .eq("deletion_source", "account")
    .not("deleted_at", "is", null);

  for (const p of (pages ?? []) as { id: string; blocked_before_deletion: boolean | null }[]) {
    const { error } = await service
      .from("agencies")
      .update({
        name:       "(Restored page, please update its details)",
        is_blocked: p.blocked_before_deletion === true,
        deleted_at: null,
        deletion_source: null,
        blocked_before_deletion: null,
      })
      .eq("id", p.id);
    if (error) throw new Error(`Could not restore Rental Page: ${error.message}`);
  }
}

/**
 * Soft-deletes the user: PII scrubbed, KYC/avatar storage files
 * removed, auth.users email + password scrambled so passwordless OTP
 * lookup fails. The auth.users row itself is kept (deleting it would
 * cascade-delete the profile via FK). If the user owns any Rental
 * Pages owned by the account all get soft-deleted too.
 */
export async function softDeleteUser(userId: string): Promise<void> {
  const service = await createServiceClient();
  const shortId = userId.slice(0, 8).toUpperCase();

  // Read what we need BEFORE scrubbing, we need email + name for the
  // confirmation/undelete email.
  const { data: profileRow, error: profileError } = await service
    .from("profiles")
    .select("full_name, email, nic_url, identity_back_url, selfie_url, avatar_url, license_front_url, license_back_url, role")
    .eq("id", userId)
    .single();
  if (profileError) throw new Error(`Could not read account before deletion: ${profileError.message}`);
  const profile = profileRow as {
    full_name: string;
    email: string | null;
    nic_url: string | null;
    identity_back_url: string | null;
    selfie_url: string | null;
    avatar_url: string | null;
    license_front_url: string | null;
    license_back_url: string | null;
    role: string;
  } | null;

  if (!profile) return;

  const { data: ownedPageAssets, error: pageAssetError } = await service
    .from("agencies")
    .select("logo_url, cover_url, business_reg_url")
    .eq("owner_id", userId)
    .is("deleted_at", null);
  if (pageAssetError) throw new Error(`Could not read Rental Page assets before deletion: ${pageAssetError.message}`);

  // Build the deletion timestamp + undelete token NOW so the email shows
  // the same `deleted_at` we're about to persist (HMAC binds the two).
  const deletedAt = new Date().toISOString();

  // Send the recovery link before the atomic scrub wipes the address. The
  // wording deliberately describes a confirmed request, rather than claiming
  // completion before the database transaction has committed.
  const realEmail = profile.email && !profile.email.endsWith("@phone.drivelink.invalid")
    ? profile.email
    : null;
  if (realEmail) {
    const token  = await generateUndeleteToken(userId, deletedAt);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk";
    const undeleteUrl = `${appUrl}/api/account/undelete?u=${encodeURIComponent(userId)}&t=${token}`;
    try {
      const result = await sendEmail({
        to:      realEmail,
        subject: "DriveLink account deletion recovery link",
        text:    `Hi ${profile.full_name},\n\nDriveLink received a confirmed request to delete your account. This recovery link is sent before the deletion is finalized so a failed email can never leave you without a recovery path. Once deletion completes, your public name, address and contact details are removed, and stored identity and licence images are deleted. Booking history remains visible in anonymised form to Rental Pages or renters you transacted with. A limited phone/identity-number safety record can remain private to prevent ban evasion.\n\nIf you made the request and deletion completes: no action is needed.\n\nIf you did not make the request, use the link below within 30 days, then tighten your login security. The link becomes valid only after deletion completes. Deleted identity and licence files are not restored, and identity verification must be completed again.\n\n${undeleteUrl}\n\nLink expires after 30 days.\n\nDriveLink Support`,
        html:    `<p>Hi ${profile.full_name},</p><p>DriveLink received a confirmed request to delete your account. This recovery link is sent before deletion is finalized so a failed email can never leave you without a recovery path.</p><p>Once deletion completes, your public name, address and contact details are removed, and stored identity and licence images are deleted. Booking history remains visible in anonymised form to Rental Pages or renters you transacted with. A limited phone/identity-number safety record can remain private to prevent ban evasion.</p><p><strong>If you made the request and deletion completes:</strong> no action is needed.</p><p><strong>If you did not:</strong> use the link below within 30 days, then tighten your login security. The link becomes valid only after deletion completes. Deleted identity and licence files are not restored, and identity verification must be completed again.</p><p><a href="${undeleteUrl}" style="background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Restore my account</a></p><div style="margin-top:20px;padding:12px;background:#fef3c7;border-left:3px solid #f59e0b;color:#92400e;font-size:13px"><strong>Tighten your account security:</strong><br>Change your email password and do not reuse it elsewhere.<br>Enable 2FA on your email provider.<br>Watch for unauthorised SIM-swap activity.<br>If you suspect compromise, contact support@drivelink.lk.</div><p style="color:#64748b;font-size:12px;margin-top:20px">Link expires in 30 days. After that the account cannot be restored.</p>`,
      });
      if (!result.ok) {
        console.error("[deletion] recovery email was not accepted", result.error);
        throw new RecoveryEmailDeliveryError();
      }
    } catch (err) {
      if (err instanceof RecoveryEmailDeliveryError) throw err;
      console.error("[deletion] recovery email send failed", err);
      throw new RecoveryEmailDeliveryError();
    }
  }

  // Pages, analytics links, security challenges and profile PII are changed in
  // one database transaction. A failure on any page rolls the whole deletion
  // back instead of leaving a multi-page owner half deleted.
  const { error: accountDeleteError } = await service.rpc("soft_delete_account_records", {
    p_user_id: userId,
    p_deleted_at: deletedAt,
  });
  if (accountDeleteError) throw new Error(`Could not delete account records: ${accountDeleteError.message}`);

  // Storage cleanup is best-effort after the atomic database scrub, using the
  // URLs captured beforehand. Includes BOTH driving-licence images because
  // leaving either private object behind would break the deletion promise.
  if (profile.nic_url)           await deleteStorageObjectByUrl(profile.nic_url);
  if (profile.identity_back_url) await deleteStorageObjectByUrl(profile.identity_back_url);
  if (profile.selfie_url)        await deleteStorageObjectByUrl(profile.selfie_url);
  if (profile.avatar_url)        await deleteStorageObjectByUrl(profile.avatar_url);
  if (profile.license_front_url) await deleteStorageObjectByUrl(profile.license_front_url);
  if (profile.license_back_url)  await deleteStorageObjectByUrl(profile.license_back_url);
  for (const page of (ownedPageAssets ?? []) as { logo_url: string | null; cover_url: string | null; business_reg_url: string | null }[]) {
    for (const url of [page.logo_url, page.cover_url, page.business_reg_url]) {
      if (url) await deleteStorageObjectByUrl(url);
    }
  }

  // Scramble auth.users.email + password so login lookup fails entirely
  const admin = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email:    `deleted+${userId.replace(/-/g, "")}@drivelink.invalid`,
    password: randomHex(32),
    user_metadata: { full_name: `Deleted user #${shortId}`, deleted: true },
  });
  // Database deletion is already committed. Login routes reject deleted
  // profiles and the caller signs out the current session, so an auth-provider
  // cleanup failure is logged for operations instead of falsely telling the
  // person that nothing was deleted.
  if (authError) console.error("[deletion] could not scramble auth login", authError.message);
}
