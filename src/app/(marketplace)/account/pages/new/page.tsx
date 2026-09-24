import { redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import { ShieldCheck } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { PageCreateForm } from "@/components/account/PageCreateForm";
import { pageShellClass } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { isPlaceholderEmail } from "@/lib/auth/placeholder-email";

export const metadata = {
  title: "Create Rental Page | DriveLink",
};

export default async function NewRentalPagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/pages/new");
  await requireVerifiedIdentity("/account/pages/new");

  // Service client: phone, phone_verified and kyc_status are protected columns
  // a browser session cannot select. The session user pins the row.
  const service = await createServiceClient();
  const { data: profileData } = await service
    .from("profiles")
    .select("kyc_status, full_name, phone, phone_verified, email")
    .eq("id", user.id)
    .single();
  const profile = profileData as {
    kyc_status: string;
    full_name: string | null;
    phone: string | null;
    phone_verified: boolean | null;
    email: string | null;
  } | null;
  if (!profile) redirect("/login");

  const isVerified = profile.kyc_status === "verified";
  const verifiedPhone = profile.phone_verified && profile.phone ? profile.phone : null;
  const realEmail = profile.email && !isPlaceholderEmail(profile.email) ? profile.email : "";

  return (
    <div className={pageShellClass("narrow", "space-y-6")}>
      {!isVerified ? (
        <>
          <PageHeader title="Verify your identity first" backHref="/account" backLabel="Back to my account" />
          <Card padding="lg">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600">
              <ShieldCheck size={20} />
            </div>
            <p className="mb-5 text-sm leading-6 text-slate-600">
              Every host on DriveLink is identity-verified. It takes about 2 minutes.
            </p>
            <DiditVerifyButton redirectPath="/account/pages/new" label="Verify my identity" />
          </Card>
        </>
      ) : (
        <>
          <PageHeader
            title="Set up your Rental Page"
            description="This is the page renters see your vehicles on. We filled in what we already know, so pick your city and check the rest."
            backHref="/account"
            backLabel="Back to my account"
          />
          <Card padding="lg">
            <PageCreateForm
              defaults={{
                name: profile.full_name?.trim() ?? "",
                whatsapp: verifiedPhone ?? "",
                email: realEmail,
                verifiedPhone,
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
