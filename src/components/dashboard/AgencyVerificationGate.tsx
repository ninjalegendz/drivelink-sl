import Link from "next/link";
import { ShieldAlert, UserCheck } from "lucide-react";

interface Props {
  /** profiles.kyc_status, true when owner finished Didit verification. */
  ownerKycVerified:  boolean;
}

/**
 * Full-page gate shown on dashboard surfaces that mutate the fleet
 * (add a vehicle, edit a vehicle). RLS enforces the same rules at the
 * DB level, this just gives a friendlier explanation than a save-time
 * "permission denied".
 */
export function AgencyVerificationGate({ ownerKycVerified }: Props) {
  return (
    <div className="max-w-xl">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert size={22} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-slate-900 font-semibold text-lg">Verify your identity to list vehicles</h2>
            <p className="text-slate-700 text-sm mt-1">
              Your identity check protects renters and lets DriveLink review your Basic listing.
            </p>
          </div>
        </div>

        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${ownerKycVerified ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              <UserCheck size={12} />
            </span>
            <div>
              <p className="text-slate-900 font-medium">Owner identity verification</p>
              <p className="text-slate-600 text-xs mt-0.5">
                {ownerKycVerified
                  ? "Done, your NIC + selfie were approved by Didit."
                  : "Verify your NIC + selfie through Didit. Usually takes 2 minutes."}
              </p>
              {!ownerKycVerified && (
                <Link href="/account" className="inline-block mt-2 text-blue-600 hover:text-blue-500 text-xs font-medium">
                  Start verification →
                </Link>
              )}
            </div>
          </li>

        </ul>
      </div>
    </div>
  );
}
