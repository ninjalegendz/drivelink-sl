import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { ProfileDetailsForm } from "@/components/account/ProfileDetailsForm";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata = {
  title: "Account Settings",
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

  // Where "Back" should go for each role
  const backHref =
    profile.role === "admin"        ? "/admin" :
    profile.role === "agency_owner" ? "/dashboard" :
                                      "/account";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Account settings</h1>
      <p className="text-slate-600 text-sm mb-8">
        Update your profile, password, and personal details.
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

        {/* Rental Pages, managed per-page from each page's own dashboard */}
        <Section title="Rental Pages">
          <p className="text-slate-600 text-sm mb-3">
            Page details are managed from each page&apos;s dashboard.
          </p>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 text-sm"
          >
            Manage my Rental Pages <ArrowRight size={14} />
          </Link>
        </Section>

        {/* Danger zone, admins can't self-delete */}
        {profile.role !== "admin" && <DeleteAccountSection />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <h2 className="text-slate-900 font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
