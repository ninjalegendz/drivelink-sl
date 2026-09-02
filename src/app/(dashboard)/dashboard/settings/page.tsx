import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { PageDetailsForm } from "@/components/account/PageDetailsForm";
import { PageWhatsappVerify } from "@/components/dashboard/PageWhatsappVerify";
import { BusinessCertUpload } from "@/components/dashboard/BusinessCertUpload";
import { PageTeamSection } from "@/components/dashboard/PageTeamSection";
import { PageLifecycleControls, type PendingPageTransfer } from "@/components/dashboard/PageLifecycleControls";
import { getPageAccess } from "@/lib/pages/access";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");

  // Staff (members) share the operational surface but not identity/team/
  // verification controls - those stay with the page owner.
  const isOwner = page.owner_id === user.id;
  const pageAccess = await getPageAccess(supabase, user.id, page.id);
  if (!pageAccess.capabilities.includes("manage_page")) redirect("/dashboard");
  // Transfer records are intentionally service-only. Ownership was already
  // established from the caller-bound page above, so this cannot expose a
  // different page's handoff details.
  const service = await createServiceClient();
  const { data: transferRow } = isOwner
    ? await service.from("rental_page_transfers").select("id,status,to_owner_email,cooling_off_until,expires_at").eq("agency_id", page.id).in("status", ["awaiting_recipient", "cooling_off"]).maybeSingle()
    : { data: null };
  const transfer = transferRow as { id: string; status: "awaiting_recipient" | "cooling_off"; to_owner_email: string; cooling_off_until: string | null; expires_at: string } | null;
  const pendingTransfer: PendingPageTransfer | null = transfer ? { id: transfer.id, status: transfer.status, recipientEmail: transfer.to_owner_email, coolingOffUntil: transfer.cooling_off_until, expiresAt: transfer.expires_at } : null;

  return (
    <div>
      <div className="mb-5">
        <PageHeader
          title="Page settings"
          description="These details are shown to renters on your listings."
        />
      </div>

      <Card padding="lg">
        <PageDetailsForm page={page} />
      </Card>

      {/* PAGE-012: verify the number that receives bookings + is shown to renters */}
      {isOwner && (
        <Card padding="lg" className="mt-4">
          <p className="text-slate-900 font-semibold text-sm">Page phone verification</p>
          <p className="text-slate-500 text-xs mt-0.5 mb-3">
            {page.whatsapp_number
              ? <>Confirm you control {page.whatsapp_number}: it&apos;s where booking alerts go and what renters use to reach you.</>
              : <>Add and verify a phone number before this restored page can accept bookings again.</>}
          </p>
          <PageWhatsappVerify agencyId={page.id} verified={!!(page as { whatsapp_verified_at?: string | null }).whatsapp_verified_at} />
        </Card>
      )}

      {/* PAGE-006: business registration certificate (business pages) */}
      {isOwner && page.page_type === "business" && (
        <Card padding="lg" className="mt-4">
          <p className="text-slate-900 font-semibold text-sm">Business registration certificate</p>
          <p className="text-slate-500 text-xs mt-0.5 mb-3">
            Upload your business registration certificate. An admin reviews it before your page is marked a verified business. Private, only you and DriveLink admin can view it.
          </p>
          <BusinessCertUpload agencyId={page.id} existingUrl={page.business_reg_url} existingRegNo={page.business_reg_no} />
        </Card>
      )}

      {isOwner && page.page_type === "business" && !page.is_verified && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
          This page is pending review. An admin may contact you for your business registration certificate.
        </div>
      )}

      {/* PAGE-005: staff/team management (owner only) */}
      {isOwner && <PageTeamSection agencyId={page.id} />}

      {/* PAGE-005: page lifecycle: pause/resume + transfer (owner only) */}
      {isOwner && <PageLifecycleControls agencyId={page.id} deactivated={!!page.deactivated_at} transfer={pendingTransfer} />}
    </div>
  );
}
