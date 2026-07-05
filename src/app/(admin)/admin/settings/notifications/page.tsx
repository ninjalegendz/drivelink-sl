import { redirect } from "next/navigation";

// Merged into the tabbed /admin/settings page. Redirect for old links.
export default function AdminNotificationSettingsRedirect() {
  redirect("/admin/settings?tab=sms");
}
