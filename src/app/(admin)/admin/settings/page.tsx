import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminSettingsTabs } from "@/components/admin/AdminSettingsTabs";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export const metadata = { title: "Settings, Admin" };

// One Settings page with tabs, replaces the separate Bank / Email / SMS pages.
export default async function AdminSettingsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab =
    tab === "email" ? "email" :
    tab === "whatsapp" ? "whatsapp" :
    "sms";

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select(
      [
        "sms_signup_renter_enabled", "sms_signup_agency_enabled", "sms_login_enabled",
        "sms_phone_verify_enabled", "sms_new_booking_agency_enabled", "sms_booking_status_renter_enabled",
        "sms_admin_booking_status_renter_enabled", "sms_listing_moderation_enabled", "updated_at",
      ].join(", "),
    )
    .eq("id", true)
    .single();

  const cfg = data as Record<string, unknown> | null;
  const bool = (k: string, d = true) => (typeof cfg?.[k] === "boolean" ? (cfg[k] as boolean) : d);
  const updatedAt = (cfg?.updated_at as string | undefined) ?? null;

  const fromEmail  = process.env.RESEND_FROM_EMAIL ?? null;
  const fromName   = process.env.RESEND_FROM_NAME  ?? "DriveLink SL";
  const configured = Boolean(process.env.RESEND_API_KEY && fromEmail);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Delivery channels for signup, booking and listing notifications." />

      <div className="mt-6">
        <AdminSettingsTabs
          initialTab={initialTab}
          email={{ configured, fromEmail, fromName }}
          sms={{
            initial: {
              sms_signup_renter_enabled:               bool("sms_signup_renter_enabled"),
              sms_signup_agency_enabled:               bool("sms_signup_agency_enabled"),
              sms_login_enabled:                       bool("sms_login_enabled"),
              sms_phone_verify_enabled:                bool("sms_phone_verify_enabled"),
              sms_new_booking_agency_enabled:          bool("sms_new_booking_agency_enabled"),
              sms_booking_status_renter_enabled:       bool("sms_booking_status_renter_enabled"),
              sms_admin_booking_status_renter_enabled: bool("sms_admin_booking_status_renter_enabled"),
              sms_listing_moderation_enabled:          bool("sms_listing_moderation_enabled"),
            },
            updatedAt,
          }}
        />
      </div>
    </div>
  );
}
