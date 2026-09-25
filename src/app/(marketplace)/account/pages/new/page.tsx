import { redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NewRentalPageView } from "@/components/account/NewRentalPageView";
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
    <NewRentalPageView
      isVerified={isVerified}
      defaults={{
        name: profile.full_name?.trim() ?? "",
        whatsapp: verifiedPhone ?? "",
        email: realEmail,
        verifiedPhone,
      }}
    />
  );
}
