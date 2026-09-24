import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Camera, Clock, ScanFace, ShieldCheck } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { SignOutButton } from "@/components/account/SignOutButton";
import { Card } from "@/components/ui/Card";
import { safeReturnPath } from "@/lib/auth/require-verified-identity";
import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "Verify your identity | DriveLink",
};

// Always read fresh: this page decides whether someone may continue, and a
// cached "not verified yet" would trap a person who has just been approved.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ next?: string }>;
}

/**
 * The one step between creating an account and using it.
 *
 * A single identity check, with a passport, NIC or driving licence, replaces
 * the old pair of an ID check plus a separately reviewed driving licence. The
 * owner inspects the original licence at the handover, which was always the
 * check that mattered, so asking for it twice only added a wait.
 *
 * Three rules keep this from becoming a trap:
 *   - someone whose check is "pending" can start again, because closing the
 *     Didit window part way leaves the account pending with nothing running
 *   - browsing vehicles stays one tap away; only the account is held
 *   - support and sign out are always on the page
 */
export default async function VerifyIdentityPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const returnTo = safeReturnPath(next, "/");
  const verifyReturn = `/verify-identity?next=${encodeURIComponent(returnTo)}`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(verifyReturn)}`);

  const service = await createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("role, kyc_status, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as { role?: string; kyc_status?: string; full_name?: string | null } | null;

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.kyc_status === "verified") redirect(returnTo);

  const status = profile?.kyc_status ?? "unverified";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  // The same two facts as before (which documents qualify, and the two-part
  // photo-then-selfie flow), now read as three short steps instead of a
  // document list plus a separate timing note.
  const steps = [
    { Icon: ShieldCheck, title: "Pick a document", description: "Passport, National Identity Card (NIC), or driving licence." },
    { Icon: Camera,      title: "Photograph it",    description: "A clear photo of the document, no glare or blur." },
    { Icon: ScanFace,    title: "Take a quick selfie", description: "So we know the document is yours." },
  ] as const;

  return (
    <Card padding="lg" className="space-y-7">
      <div className="space-y-2">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-700">
          <ShieldCheck size={24} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {firstName ? `One last step, ${firstName}` : "One last step"}
        </h1>
        <p className="text-sm leading-6 text-slate-600 sm:text-base">
          Verify your identity to start using DriveLink. Every renter and every owner on the
          marketplace is verified, so both sides know who they are dealing with.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
          What happens next, about two minutes
        </p>
        <ol className="space-y-4">
          {steps.map(({ Icon, title, description }, i) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
                <Icon size={16} aria-hidden="true" />
                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-slate-950 text-[9px] font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <div className="space-y-0.5 pt-1">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {status === "pending" && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Clock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Your check is being reviewed</p>
            <p className="text-blue-900/80">
              This usually finishes within a few minutes.{" "}
              <Link href={verifyReturn} className="font-semibold underline">Check again</Link>. If you
              closed the verification before finishing, start it again below.
            </p>
          </div>
        </div>
      )}

      {status === "rejected" && (
        <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">That attempt did not go through</p>
            <p className="text-rose-800/90">
              The usual causes are glare on the document, a blurry photo, or a face that is not fully
              in frame. Try again in good light.
            </p>
          </div>
        </div>
      )}

      <DiditVerifyButton
        redirectPath={verifyReturn}
        label={
          status === "rejected" ? "Try again"
            : status === "pending" ? "Start verification again"
            : "Verify my identity"
        }
      />

      <div className="space-y-3 border-t border-slate-200 pt-5 text-sm">
        <Link href="/vehicles" className="block font-semibold text-blue-700 hover:underline">
          Keep browsing vehicles for now
        </Link>
        <p className="text-slate-500">
          Stuck?{" "}
          <a
            href={`https://wa.me/${siteConfig.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-700 underline"
          >
            WhatsApp us
          </a>{" "}
          or email{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="font-medium text-slate-700 underline">
            {siteConfig.supportEmail}
          </a>
          .
        </p>
        <SignOutButton />
      </div>
    </Card>
  );
}
