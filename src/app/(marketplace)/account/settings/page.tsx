import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { ProfileDetailsForm } from "@/components/account/ProfileDetailsForm";
import { AgencyDetailsForm } from "@/components/account/AgencyDetailsForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AgencyRow  = Database["public"]["Tables"]["agencies"]["Row"];

export const metadata = {
  title: "Account settings — DriveLink SL",
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/settings");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profileData) redirect("/login");
  const profile = profileData as ProfileRow;

  let agency: AgencyRow | null = null;
  if (profile.role === "agency_owner") {
    const { data } = await supabase
      .from("agencies")
      .select("*")
      .eq("owner_id", user.id)
      .single();
    agency = data as AgencyRow | null;
  }

  // Where "Back" should go for each role
  const backHref =
    profile.role === "admin"        ? "/admin" :
    profile.role === "agency_owner" ? "/dashboard" :
                                      "/account";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <h1 className="text-2xl font-bold text-white mb-1">Account settings</h1>
      <p className="text-slate-400 text-sm mb-8">
        Update your profile, password, and {profile.role === "agency_owner" ? "agency" : "personal"} details.
      </p>

      <div className="space-y-6">

        {/* Profile picture */}
        <Section title="Profile picture">
          <AvatarUploader
            userId={user.id}
            initialAvatarUrl={profile.avatar_url}
            fullName={profile.full_name}
          />
        </Section>

        {/* Profile details */}
        <Section title="Personal details">
          <ProfileDetailsForm
            userId={user.id}
            initialFullName={profile.full_name}
            initialPhone={profile.phone}
            email={user.email ?? ""}
          />
        </Section>

        {/* Agency details (agency owners only) */}
        {profile.role === "agency_owner" && agency && (
          <Section title="Agency details">
            <AgencyDetailsForm
              agencyId={agency.id}
              initialName={agency.name}
              initialCity={agency.city}
              initialAddress={agency.address}
              initialPhone={agency.whatsapp_number}
              initialDescription={agency.description}
            />
          </Section>
        )}

        {profile.role === "agency_owner" && !agency && (
          <Section title="Agency details">
            <p className="text-slate-400 text-sm">
              You haven&apos;t set up your agency yet.{" "}
              <Link href="/signup/agency" className="text-amber-400 hover:text-amber-300">
                Complete onboarding →
              </Link>
            </p>
          </Section>
        )}

        {/* Password */}
        <Section title="Password">
          <ChangePasswordForm email={user.email ?? ""} />
        </Section>

        {/* Danger zone — admins can't self-delete */}
        {profile.role !== "admin" && <DeleteAccountSection />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="text-white font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
