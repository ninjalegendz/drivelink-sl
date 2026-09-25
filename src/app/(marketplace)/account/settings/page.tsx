import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata = {
  title: "Account Settings",
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/settings");

  // Service client for the own-row read: settings shows phone/email, which
  // are protected columns browser sessions can't SELECT. auth.getUser()
  // above pins the row to the caller.
  const service = await createServiceClient();
  const { data: profileData } = await service
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profileData) redirect("/login");
  const profile = profileData as ProfileRow;

  // Where "Back" should go for each role
  const backHref =
    profile.role === "admin"        ? "/admin" :
    profile.role === "agency_owner" ? "/dashboard" :
                                      "/account";

  return (
    <AccountSettingsView
      userId={user.id}
      fullName={profile.full_name}
      phone={profile.phone}
      avatarUrl={profile.avatar_url}
      authEmail={user.email ?? ""}
      backHref={backHref}
      canDeleteAccount={profile.role !== "admin"}
    />
  );
}
