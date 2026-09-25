import { guardDesignPreview } from "@/app/design/guard";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import { DEMO_ACCOUNT_SETTINGS } from "@/lib/demo/account-more";

export const metadata = { title: "Design preview: account settings" };

// Renders the real AccountSettingsView with sample data, between the same
// NavbarShell/Footer as /design/account. See src/app/design/layout.tsx: this
// whole area 404s in production. AvatarUploader and ProfileDetailsForm only
// call their APIs on submit, so nothing fires on mount here.
export default function DesignAccountSettingsPage() {
  guardDesignPreview();
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name={DEMO_ACCOUNT_SETTINGS.fullName} avatarUrl={null} />
      <div className="py-8">
        <AccountSettingsView
          {...DEMO_ACCOUNT_SETTINGS}
          backHref="/account"
          canDeleteAccount
        />
      </div>
      <Footer />
    </div>
  );
}
