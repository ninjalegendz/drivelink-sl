import Link from "next/link";
import { ShieldAlert, UserCheck, Building2 } from "lucide-react";

interface Props {
  /** profiles.kyc_status — true when owner finished Didit verification. */
  ownerKycVerified:  boolean;
  /** agencies.is_verified — true when admin approved the agency. */
  agencyApproved:    boolean;
}

/**
 * Full-page gate shown on dashboard surfaces that mutate the fleet
 * (add a vehicle, edit a vehicle). RLS enforces the same rules at the
 * DB level — this just gives a friendlier explanation than a save-time
 * "permission denied".
 */
export function AgencyVerificationGate({ ownerKycVerified, agencyApproved }: Props) {
  return (
    <div className="max-w-xl">
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert size={22} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-white font-semibold text-lg">Complete verification to list vehicles</h2>
            <p className="text-slate-300 text-sm mt-1">
              For renter safety we list only verified agencies. Both checks below need to clear.
            </p>
          </div>
        </div>

        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${ownerKycVerified ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
              <UserCheck size={12} />
            </span>
            <div>
              <p className="text-white font-medium">Owner identity verification</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {ownerKycVerified
                  ? "Done — your NIC + selfie were approved by Didit."
                  : "Verify your NIC + selfie through Didit. Usually takes 2 minutes."}
              </p>
              {!ownerKycVerified && (
                <Link href="/account" className="inline-block mt-2 text-amber-400 hover:text-amber-300 text-xs font-medium">
                  Start verification →
                </Link>
              )}
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${agencyApproved ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
              <Building2 size={12} />
            </span>
            <div>
              <p className="text-white font-medium">Agency admin review</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {agencyApproved
                  ? "Done — your agency is approved."
                  : "An admin reviews your agency details. Usually within 24 hours."}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
