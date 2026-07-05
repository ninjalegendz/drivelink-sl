import { createClient } from "@/lib/supabase/server";
import { Settings } from "lucide-react";
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
    tab === "sms" ? "sms" :
    tab === "whatsapp" ? "whatsapp" :
    "bank";

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select(
      [
        "bank_account_name", "bank_name", "bank_account_number", "bank_branch",
        "sms_signup_renter_enabled", "sms_signup_agency_enabled", "sms_login_enabled",
        "sms_phone_verify_enabled", "sms_new_booking_agency_enabled", "sms_booking_status_renter_enabled",
        "sms_admin_booking_status_renter_enabled", "sms_expiry_renter_enabled", "sms_expiry_agency_enabled",
        "booking_fee_lkr", "updated_at",
      ].join(", "),
    )
    .eq("id", true)
    .single();

  const cfg = data as Record<string, unknown> | null;
  const str = (k: string, d = "") => (typeof cfg?.[k] === "string" ? (cfg[k] as string) : d);
  const bool = (k: string, d = true) => (typeof cfg?.[k] === "boolean" ? (cfg[k] as boolean) : d);
  const num = (k: string, d = 0) => (typeof cfg?.[k] === "number" ? (cfg[k] as number) : d);
  const updatedAt = (cfg?.updated_at as string | undefined) ?? null;

  const fromEmail  = process.env.RESEND_FROM_EMAIL ?? null;
  const fromName   = process.env.RESEND_FROM_NAME  ?? "DriveLink SL";
  const configured = Boolean(process.env.RESEND_API_KEY && fromEmail);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-blue-600" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </div>

      <AdminSettingsTabs
        initialTab={initialTab}
        bank={{
          initial: {
            bank_account_name:   str("bank_account_name", "DriveLink SL"),
            bank_name:           str("bank_name", "Commercial Bank"),
            bank_account_number: str("bank_account_number"),
            bank_branch:         str("bank_branch"),
          },
          updatedAt,
        }}
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
            sms_expiry_renter_enabled:               bool("sms_expiry_renter_enabled"),
            sms_expiry_agency_enabled:               bool("sms_expiry_agency_enabled"),
            booking_fee_lkr:                         num("booking_fee_lkr"),
          },
          updatedAt,
        }}
      />
    </div>
  );
}
