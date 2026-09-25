import { ShieldCheck } from "lucide-react";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { PageCreateForm, type PageCreateDefaults } from "@/components/account/PageCreateForm";
import { pageShellClass } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export interface NewRentalPageViewProps {
  isVerified: boolean;
  defaults: PageCreateDefaults;
}

/**
 * Setting up a Rental Page: identity verification first (every host on
 * DriveLink is verified), then the create form pre-filled from the account.
 * Presentation only, split out of (marketplace)/account/pages/new/page.tsx so
 * it can be previewed with sample data under /design/account/pages/new.
 * Every query and redirect stays in that data page unchanged.
 */
export function NewRentalPageView({ isVerified, defaults }: NewRentalPageViewProps) {
  if (!isVerified) {
    return (
      <div className={pageShellClass("narrow", "space-y-6")}>
        <PageHeader title="Verify your identity first" backHref="/account" backLabel="Back to my account" />
        <Card padding="lg">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <p className="mb-5 text-sm leading-6 text-slate-600">
            Every host on DriveLink is identity-verified. It takes about 2 minutes.
          </p>
          <DiditVerifyButton redirectPath="/account/pages/new" label="Verify my identity" />
        </Card>
      </div>
    );
  }

  return (
    <div className={pageShellClass("narrow", "space-y-6")}>
      <PageHeader
        title="Set up your Rental Page"
        description="This is the page renters see your vehicles on. We filled in what we already know, so pick your city and check the rest."
        backHref="/account"
        backLabel="Back to my account"
      />
      <Card padding="lg">
        <PageCreateForm defaults={defaults} />
      </Card>
    </div>
  );
}
