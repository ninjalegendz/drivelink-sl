import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { ProfileDetailsForm } from "@/components/account/ProfileDetailsForm";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { pageShellClass } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export interface AccountSettingsViewProps {
  userId: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  /** The Supabase auth email, shown as the account's sign-in email. */
  authEmail: string;
  backHref: string;
  /** Admins can't self-delete their account. */
  canDeleteAccount: boolean;
}

/**
 * Personal account settings: photo, name and phone, a way back into Rental
 * Pages, and (for non-admins) the danger zone. Presentation only, split out
 * of (marketplace)/account/settings/page.tsx so it can be previewed with
 * sample data under /design/account/settings. Every query and redirect stays
 * in that data page unchanged.
 */
export function AccountSettingsView({ userId, fullName, phone, avatarUrl, authEmail, backHref, canDeleteAccount }: AccountSettingsViewProps) {
  return (
    <div className={pageShellClass("narrow", "space-y-6")}>
      <PageHeader
        title="Account settings"
        description="Update your contact and personal details."
        backHref={backHref}
      />

      <Section title="Profile picture">
        <AvatarUploader userId={userId} initialAvatarUrl={avatarUrl} fullName={fullName} />
      </Section>

      <Section title="Personal details">
        <ProfileDetailsForm userId={userId} initialFullName={fullName} initialPhone={phone} email={authEmail} />
      </Section>

      <Section title="Rental Pages">
        <p className="mb-3 text-sm text-slate-600">
          Page details are managed from each page&apos;s dashboard.
        </p>
        <Link
          href="/account"
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          Manage my Rental Pages <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </Section>

      {canDeleteAccount && <DeleteAccountSection />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding="lg">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </Card>
  );
}
