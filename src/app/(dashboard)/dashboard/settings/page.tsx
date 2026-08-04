import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { PageDetailsForm } from "@/components/account/PageDetailsForm";
import { PageWhatsappVerify } from "@/components/dashboard/PageWhatsappVerify";
import { BusinessCertUpload } from "@/components/dashboard/BusinessCertUpload";
import { PageTeamSection } from "@/components/dashboard/PageTeamSection";
import { PageLifecycleControls } from "@/components/dashboard/PageLifecycleControls";

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");

  // Staff (members) share the operational surface but not identity/team/
  // verification controls - those stay with the page owner.
  const isOwner = page.owner_id === user.id;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Settings size={22} className="text-blue-600" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-slate-900">Page settings</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">
        These details are shown to renters on your listings.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <PageDetailsForm page={page} />
      </div>

      {/* PAGE-012: verify the number that receives bookings + is shown to renters */}
      {isOwner && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <p className="text-slate-900 font-semibold text-sm">Page phone verification</p>
          <p className="text-slate-500 text-xs mt-0.5 mb-3">
            Confirm you control {page.whatsapp_number}: it's where booking alerts go and what renters use to reach you.
          </p>
          <PageWhatsappVerify agencyId={page.id} verified={!!(page as { whatsapp_verified_at?: string | null }).whatsapp_verified_at} />
        </div>
      )}

      {/* PAGE-006: business registration certificate (business pages) */}
      {isOwner && page.page_type === "business" && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <p className="text-slate-900 font-semibold text-sm">Business registration certificate</p>
          <p className="text-slate-500 text-xs mt-0.5 mb-3">
            Upload your business registration certificate. An admin reviews it before your page is marked a verified business. Private, only you and DriveLink admin can view it.
          </p>
          <BusinessCertUpload agencyId={page.id} existingUrl={page.business_reg_url} existingRegNo={page.business_reg_no} />
        </div>
      )}

      {isOwner && page.page_type === "business" && !page.is_verified && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
          This page is pending review. An admin may contact you for your business registration certificate.
        </div>
      )}

      {/* PAGE-005: staff/team management (owner only) */}
      {isOwner && <PageTeamSection agencyId={page.id} />}

      {/* PAGE-005: page lifecycle: pause/resume + transfer (owner only) */}
      {isOwner && <PageLifecycleControls agencyId={page.id} deactivated={!!page.deactivated_at} />}
    </div>
  );
}
