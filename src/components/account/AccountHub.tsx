import Link from "next/link";
import {
  CalendarCheck, FileText, Building2, Settings, Headphones, Check,
  Mail, Phone as PhoneIcon, ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/layout/NavbarShell";
import { pageShellClass } from "@/components/ui/PageShell";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { PhoneVerifyForm } from "@/components/account/PhoneVerifyForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { RentalPageList, type RentalPageListEntry } from "@/components/account/RentalPageList";
import { TeamInvitations, type TeamInvitation } from "@/components/account/TeamInvitations";
import { PageTransferInvitations, type PageTransferInvitation } from "@/components/account/PageTransferInvitations";
import { formatPhone } from "@/lib/format/phone";

// The renter/host personal area ("You"): a profile header, one obvious way
// into every other personal screen, the account's Rental Pages, and the
// identity check that unlocks booking. Presentation only, split out of
// account/page.tsx so it can be rendered with sample data under /design.

export interface AccountHubProfile {
  full_name: string;
  phone: string;
  phone_verified: boolean;
  email: string | null;
  email_verified_at: string | null;
  role: string;
  kyc_status: string;
  created_at: string;
  avatar_url: string | null;
}

interface Props {
  profile: AccountHubProfile;
  /** The Supabase auth email, shown in Account details. Can differ from profile.email. */
  authEmail: string | null;
  pages: RentalPageListEntry[];
  teamInvitations: TeamInvitation[];
  pageTransferInvitations: PageTransferInvitation[];
  welcome?: string;
  didit?: string;
}

const kycLabel: Record<string, string> = {
  unverified: "Not verified",
  pending: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

export function AccountHub({ profile, authEmail, pages, teamInvitations, pageTransferInvitations, welcome, didit }: Props) {
  const isVerified = profile.kyc_status === "verified";
  const canVerify = profile.kyc_status === "unverified" || profile.kyc_status === "rejected";
  const isPending = profile.kyc_status === "pending";
  const isAdmin = profile.role === "admin";
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-LK", { year: "numeric", month: "long" });

  // My bookings, documents and support stay hidden for admins (decision 9:
  // admins run verification rather than rent vehicles themselves). Rental
  // Pages and Settings apply to every account.
  const tiles = [
    !isAdmin && { href: "/bookings", label: "Your bookings", description: "Every request and rental in progress", icon: CalendarCheck },
    !isAdmin && { href: "/account/documents", label: "Documents", description: "Who has viewed your ID, and when", icon: FileText },
    { href: "#rental-pages", label: "Rental Pages", description: pages.length > 0 ? "Manage what you rent out" : "Start renting out a vehicle", icon: Building2 },
    { href: "/account/settings", label: "Settings", description: "Your name, phone and account", icon: Settings },
    !isAdmin && { href: "/account/support", label: "Support", description: "Message the DriveLink team", icon: Headphones },
  ].filter(Boolean) as { href: string; label: string; description: string; icon: typeof CalendarCheck }[];

  return (
    <div className={pageShellClass("narrow", "space-y-8")}>

      {/* Profile header */}
      <div className="animate-fade-up flex items-center gap-4 sm:gap-5">
        <Avatar name={profile.full_name} avatarUrl={profile.avatar_url} size={72} />
        <div className="min-w-0 space-y-1.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{profile.full_name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            {profile.email && (
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                <Mail size={13} className="shrink-0 text-slate-400" aria-hidden="true" /> {profile.email}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon size={13} className="shrink-0 text-slate-400" aria-hidden="true" /> {profile.phone}
            </span>
          </div>
          {/* Personal trust checks. Public reviews belong to Rental Pages, not people. */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Badge variant={profile.phone_verified ? "green" : "amber"}>Phone {profile.phone_verified ? "verified" : "unverified"}</Badge>
            <Badge variant={isVerified ? "green" : profile.kyc_status === "rejected" ? "red" : "amber"}>
              ID {kycLabel[profile.kyc_status ?? "unverified"].toLowerCase()}
            </Badge>
            <span className="text-xs text-slate-500">Member since {memberSince}</span>
          </div>
        </div>
      </div>

      {/* The one thing to finish, right under the header. Disappears once
          identity, phone and (when there is an email on file) email are all
          done, leaving only the compact badges above. */}
      <FinishSetupCard
        profile={profile}
        isVerified={isVerified}
        isPending={isPending}
        canVerify={canVerify}
        welcome={welcome}
        didit={didit}
      />

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="spring-hover group flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:ring-blue-200 sm:p-5"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
              <tile.icon size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{tile.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">{tile.description}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* My Rental Pages (every signed-in account can host now) */}
      <div id="rental-pages" className="scroll-mt-24">
        <RentalPageList pages={pages} />
      </div>

      <TeamInvitations invitations={teamInvitations} />
      <PageTransferInvitations invitations={pageTransferInvitations} />

      {/* Account details */}
      <Card padding="lg">
        <h2 className="text-base font-semibold text-slate-900">Account details</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Name">{profile.full_name}</Row>
          <Row label="Email">{authEmail ?? "-"}</Row>
          <div className="flex items-start justify-between gap-4">
            <dt className="pt-1.5 text-slate-500">Mobile</dt>
            <dd className="text-right">
              <span className="font-medium text-slate-900">{formatPhone(profile.phone)}</span>
              {/* The real verify flow lives in the checklist above while
                  something is still unfinished, so this stays a small link
                  rather than a second copy of the same form. */}
              <div className="mt-2 flex justify-end">
                {profile.phone_verified ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <Check size={13} aria-hidden="true" /> Verified
                  </span>
                ) : (
                  <a href="#finish-setup" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                    Verify phone
                  </a>
                )}
              </div>
            </dd>
          </div>
          <Row label="Member since">{memberSince}</Row>
        </dl>
      </Card>

      <div className="flex justify-center pb-2 pt-2">
        <SignOutButton />
      </div>
    </div>
  );
}

// Checklist wording is its own scale, separate from the header's compact
// badge labels: "Not started" reads better as a task status than "Not
// verified" does.
const IDENTITY_TASK_LABEL: Record<string, string> = {
  unverified: "Not started",
  pending: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

function FinishSetupCard({
  profile, isVerified, isPending, canVerify, welcome, didit,
}: {
  profile: AccountHubProfile;
  isVerified: boolean;
  isPending: boolean;
  canVerify: boolean;
  welcome?: string;
  didit?: string;
}) {
  const phoneDone = profile.phone_verified;
  const hasEmail = Boolean(profile.email);
  const emailDone = hasEmail ? Boolean(profile.email_verified_at) : true;

  const tasks = [isVerified, phoneDone, ...(hasEmail ? [emailDone] : [])];
  const doneCount = tasks.filter(Boolean).length;
  const allDone = doneCount === tasks.length;

  if (allDone) return null;

  const identityTone = isVerified ? "green" : profile.kyc_status === "rejected" ? "red" : "amber";
  const identityStep = isVerified ? 2 : isPending ? 1 : 0;
  const identitySteps = ["Start verification", "Didit reviews your ID", "Identity confirmed"];

  return (
    <Card id="finish-setup" padding="lg" className="animate-fade-up scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Finish setting up</h2>
        <span className="text-xs font-medium text-slate-500">{doneCount} of {tasks.length} done</span>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {welcome ? "Your account is live. " : ""}Finish these to unlock booking, Rental Page owners confirm verified renters faster.
      </p>

      <ul className="mt-4 divide-y divide-slate-100">
        {/* Identity check */}
        <li className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">
              Identity check <span className="ml-1 text-xs font-normal text-slate-500">Required to book</span>
            </p>
            <Badge variant={identityTone}>{IDENTITY_TASK_LABEL[profile.kyc_status ?? "unverified"]}</Badge>
          </div>

          {isPending && (
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Didit is reviewing your documents. This usually takes a few minutes.
              This page will update automatically, you can also refresh.
            </p>
          )}
          {profile.kyc_status === "rejected" && !didit && (
            <p className="mt-1.5 text-xs leading-5 text-rose-700">
              Didit could not verify your identity. Common reasons: blurry photo, glare on ID,
              face not clearly visible. Please try again with better lighting.
            </p>
          )}
          {isVerified && (
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Your ID and face have been confirmed. You can book any vehicle on DriveLink.
            </p>
          )}

          {canVerify && (
            <div className="mt-3">
              <DiditVerifyButton
                redirectPath="/account?didit=done"
                label={profile.kyc_status === "rejected" ? "Try verification again" : "Verify my identity"}
              />
            </div>
          )}
        </li>

        {/* Phone number */}
        <li className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">Phone number</p>
            <Badge variant={phoneDone ? "green" : "amber"}>{phoneDone ? "Verified" : "Not verified"}</Badge>
          </div>
          {!phoneDone && (
            <div className="mt-3">
              <PhoneVerifyForm phone={profile.phone} verified={profile.phone_verified} />
            </div>
          )}
        </li>

        {/* Email, optional */}
        {hasEmail && (
          <li className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                Email <span className="ml-1 text-xs font-normal text-slate-500">Optional</span>
              </p>
              <Badge variant={emailDone ? "green" : "amber"}>{emailDone ? "Verified" : "Not verified"}</Badge>
            </div>
            {!emailDone && (
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                We&apos;ve sent a link to <span className="font-mono">{profile.email}</span>. Clicking it
                gives DriveLink a second way to send important booking and account notices.
              </p>
            )}
          </li>
        )}
      </ul>

      {/* Identity stepper, "Powered by Didit" verification and the privacy
          paragraph, tucked away so the checklist stays scannable. Wording
          unchanged from the previous always-open card. */}
      <details className="group mt-4 border-t border-slate-100 pt-4">
        <summary className="inline-flex min-h-6 cursor-pointer select-none list-none items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
          How the identity check works
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="mt-4">
          <div className="flex items-start gap-0">
            {identitySteps.map((label, i) => {
              const done = i < identityStep;
              const current = i === identityStep;
              const isLast = i === identitySteps.length - 1;
              return (
                <div key={label} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                      done ? "bg-emerald-600 text-white" : current ? "bg-blue-600 text-white" : "bg-white text-slate-400 ring-1 ring-inset ring-slate-300"
                    }`}>
                      {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </div>
                    <p className={`mt-1.5 w-20 text-center text-xs leading-tight ${done || current ? "text-slate-900" : "text-slate-500"}`}>
                      {label}
                    </p>
                  </div>
                  {!isLast && <div aria-hidden="true" className={`mx-2 mb-5 h-px flex-1 ${done ? "bg-emerald-500" : "bg-slate-200"}`} />}
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-center text-xs text-slate-500">
            Didit performs the identity and liveness check. After approval, DriveLink keeps a protected front/back copy of the approved government ID for confirmed-booking handover. It is never public, and the liveness selfie is not shared with Rental Pages. Verification is provided by{" "}
            <a
              href="https://didit.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 underline hover:text-slate-700"
            >
              Didit
            </a>.
          </p>
        </div>
      </details>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
