import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PageDetailsForm } from "@/components/account/PageDetailsForm";
import { PageWhatsappVerify } from "@/components/dashboard/PageWhatsappVerify";
import { BusinessCertUpload } from "@/components/dashboard/BusinessCertUpload";
import { PageTeamSection } from "@/components/dashboard/PageTeamSection";
import { PageLifecycleControls, type PendingPageTransfer } from "@/components/dashboard/PageLifecycleControls";
import type { TeamMember, PendingTeamInvitation } from "@/components/dashboard/PageTeamManager";
import type { RentalPageRow } from "@/types/queries";

export interface PageSettingsViewProps {
  page: RentalPageRow;
  isOwner: boolean;
  pendingTransfer: PendingPageTransfer | null;
  teamMembers: TeamMember[];
  teamPending: PendingTeamInvitation[];
}

/**
 * Page settings, grouped the way an owner thinks about them: what renters
 * see, how DriveLink reaches the page, proof of business, who else can work
 * on it, then the two things that change the page's fate. Presentation only,
 * split out of (dashboard)/dashboard/settings/page.tsx so it can be rendered
 * with sample data under /design/dashboard/settings. Every query, capability
 * check and prop this receives is computed by that data page unchanged.
 */
export function PageSettingsView({ page, isOwner, pendingTransfer, teamMembers, teamPending }: PageSettingsViewProps) {
  const isWhatsappVerified = !!(page as { whatsapp_verified_at?: string | null }).whatsapp_verified_at;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Page settings"
        description="These details are shown to renters on your listings."
      />

      <Card padding="lg">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Page details</h2>
        <PageDetailsForm page={page} />
      </Card>

      {/* PAGE-012: verify the number that receives bookings + is shown to renters */}
      {isOwner && (
        <Card padding="lg">
          <h2 className="text-base font-semibold text-slate-900">Contact and WhatsApp</h2>
          <p className="mb-3 mt-0.5 text-xs leading-5 text-slate-500">
            {page.whatsapp_number
              ? <>Confirm you control {page.whatsapp_number}: it&apos;s where booking alerts go and what renters use to reach you.</>
              : <>Add and verify a phone number before this restored page can accept bookings again.</>}
          </p>
          <PageWhatsappVerify agencyId={page.id} verified={isWhatsappVerified} />
        </Card>
      )}

      {/* PAGE-006: business registration certificate (business pages) */}
      {isOwner && page.page_type === "business" && (
        <Card padding="lg">
          <h2 className="text-base font-semibold text-slate-900">Business certificate</h2>
          <p className="mb-3 mt-0.5 text-xs leading-5 text-slate-500">
            Upload your business registration certificate. An admin reviews it before your page is marked a verified business. Private, only you and DriveLink admin can view it.
          </p>
          <BusinessCertUpload agencyId={page.id} existingUrl={page.business_reg_url} existingRegNo={page.business_reg_no} />
          {!page.is_verified && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-800 ring-1 ring-amber-200">
              This page is pending review. An admin may contact you for your business registration certificate.
            </p>
          )}
        </Card>
      )}

      {/* PAGE-005: staff/team management (owner only) */}
      {isOwner && (
        <Card padding="lg">
          <PageTeamSection agencyId={page.id} members={teamMembers} pending={teamPending} />
        </Card>
      )}

      {/* PAGE-005: page lifecycle: pause/resume + transfer (owner only) */}
      {isOwner && <PageLifecycleControls agencyId={page.id} deactivated={!!page.deactivated_at} transfer={pendingTransfer} />}
    </div>
  );
}
