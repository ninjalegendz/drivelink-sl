import { redirect } from "next/navigation";

// Merged into the tabbed /admin/settings page. Redirect for old links.
export default function AdminEmailSettingsRedirect() {
  redirect("/admin/settings?tab=email");
}
