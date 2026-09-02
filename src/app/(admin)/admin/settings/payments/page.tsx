import { redirect } from "next/navigation";

// Retired with the manual bank-transfer workflow. Keep old links useful.
export default function AdminPaymentSettingsRedirect() {
  redirect("/admin/settings?tab=sms");
}
