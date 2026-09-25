import Link from "next/link";
import { ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";

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
      <Card variant="tinted" padding="lg" className="rounded-3xl">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-blue-600 shadow-xs ring-1 ring-blue-100">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">Verify your identity to list vehicles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Your identity check protects renters and lets DriveLink review your Basic listing.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-900/[0.06]">
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${ownerKycVerified ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            <UserCheck size={13} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Owner identity verification</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {ownerKycVerified
                ? "Done, your NIC + selfie were approved by Didit."
                : "Verify your NIC + selfie through Didit. Usually takes 2 minutes."}
            </p>
            {!ownerKycVerified && (
              <Link href="/account" className={buttonClasses({ variant: "primary", size: "sm", className: "mt-3" })}>
                Start verification <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
