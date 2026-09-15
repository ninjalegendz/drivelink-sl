import { redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { PageCreateForm } from "@/components/account/PageCreateForm";
import { pageShellClass } from "@/components/ui/PageShell";

export const metadata = {
  title: "Create Rental Page | DriveLink",
};

export default async function NewRentalPagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/pages/new");
  await requireVerifiedIdentity("/account/pages/new");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .single();
  const profile = profileData as { kyc_status: string } | null;
  if (!profile) redirect("/login");

  const isVerified = profile.kyc_status === "verified";

  return (
    <div className={pageShellClass("narrow")}>
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to my account
      </Link>

      {!isVerified ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Verify your identity first</h1>
          <p className="text-slate-600 text-sm mb-5">
            Every host on DriveLink is identity-verified. It takes about 2 minutes.
          </p>
          <DiditVerifyButton redirectPath="/account/pages/new" label="Verify my identity" />
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your Rental Page</h1>
          <p className="text-slate-600 text-sm mb-6">
            Your page is what renters see. There is no lifetime page limit; use a separate page for a distinct rental brand, location, or service.
          </p>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <PageCreateForm />
          </div>
        </>
      )}
    </div>
  );
}
