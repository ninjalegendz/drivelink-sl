import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { ProfileDetailsForm } from "@/components/account/ProfileDetailsForm";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import type { Database } from "@/types/database";
import { pageShellClass } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

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
    <div className={pageShellClass("narrow", "space-y-6")}>
      <PageHeader
        title="Account settings"
        description="Update your contact and personal details."
        backHref={backHref}
      />

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
        <p className="mb-3 text-sm text-slate-600">
          Page details are managed from each page&apos;s dashboard.
        </p>
        <Link
          href="/account"
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          Manage my Rental Pages <ArrowRight size={14} />
        </Link>
      </Section>

      {/* Danger zone, admins can't self-delete */}
      {profile.role !== "admin" && <DeleteAccountSection />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding="lg">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </Card>
  );
}
