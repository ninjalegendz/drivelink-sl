import type { SupabaseClient } from "@supabase/supabase-js";

interface ApplyArgs {
  userId:    string;
  newStatus: "verified" | "rejected" | "pending";
  nic?:      string | null;
}

interface ApplyResult {
  blacklistInherited: boolean;
  inheritedReason?:   string;
}

/**
 * Centralises the "KYC just completed" side-effects. Updates kyc_status,
 * stores the verified NIC if provided, and — if the NIC has already been
 * blacklisted on some other (active) profile — propagates the block.
 * This is what makes the soft-delete + re-signup loophole impossible:
 * a previously banned renter who deletes and signs up again under a new
 * phone/email will be re-flagged the moment Didit returns their NIC.
 */
export async function applyKycVerification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  { userId, newStatus, nic }: ApplyArgs
): Promise<ApplyResult> {
  const update: Record<string, unknown> = { kyc_status: newStatus };
  if (nic) update.nic_number = nic;

  let blacklistInherited = false;
  let inheritedReason: string | undefined;

  // Only check inheritance on a fresh verified pass with an NIC we trust.
  if (newStatus === "verified" && nic) {
    const { data: hits } = await service
      .from("profiles")
      .select("id, blacklist_reason, blacklist_reason_public")
      .eq("nic_number", nic)
      .eq("is_blacklisted", true)
      .neq("id", userId)
      .limit(1);
    const hit = (hits ?? [])[0] as {
      id: string;
      blacklist_reason: string | null;
      blacklist_reason_public: string | null;
    } | undefined;

    if (hit) {
      blacklistInherited = true;
      const adminNote = hit.blacklist_reason ?? "(no admin note on prior account)";
      inheritedReason = `Inherited from prior account with the same NIC. Original admin note: ${adminNote}`;
      update.is_blacklisted          = true;
      update.blacklist_reason        = inheritedReason;
      update.blacklist_reason_public = hit.blacklist_reason_public ??
        "Same NIC as a previously blocked account. Decline at your discretion.";
    }
  }

  await service.from("profiles").update(update).eq("id", userId);

  return { blacklistInherited, inheritedReason };
}
