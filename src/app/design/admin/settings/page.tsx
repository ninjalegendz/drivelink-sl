import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminSettingsTabs } from "@/components/admin/AdminSettingsTabs";
import {
  DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY,
} from "@/lib/demo/admin";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

// See src/app/(admin)/admin/settings/page.tsx for the data-fetching original.
// WhatsAppConnect and EmailTestSender render with `preview` / `disabled` so
// nothing here polls the live WhatsApp service or sends a real email.
export default async function DesignAdminSettingsPage({ searchParams }: Props) {
  guardDesignPreview();
  const { tab } = await searchParams;
  const initialTab = tab === "email" ? "email" : tab === "whatsapp" ? "whatsapp" : "sms";

  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <div className="max-w-2xl">
        <PageHeader title="Settings" description="Delivery channels for signup, booking and listing notifications." />
        <div className="mt-6">
          <AdminSettingsTabs
            initialTab={initialTab}
            email={{ configured: true, fromEmail: "no-reply@drivelink.lk", fromName: "DriveLink SL" }}
            sms={{
              initial: {
                sms_signup_renter_enabled: true,
                sms_signup_agency_enabled: true,
                sms_login_enabled: true,
                sms_phone_verify_enabled: true,
                sms_new_booking_agency_enabled: true,
                sms_booking_status_renter_enabled: true,
                sms_admin_booking_status_renter_enabled: false,
                sms_listing_moderation_enabled: true,
              },
              updatedAt: "2026-09-20T10:00:00Z",
            }}
            preview
          />
        </div>
      </div>
    </AdminShell>
  );
}
