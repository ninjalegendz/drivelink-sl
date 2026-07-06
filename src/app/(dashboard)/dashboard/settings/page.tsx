import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { PageDetailsForm } from "@/components/account/PageDetailsForm";

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");

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

      {page.page_type === "business" && !page.is_verified && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
          This page is pending review — an admin may contact you for your business registration certificate.
        </div>
      )}
    </div>
  );
}
