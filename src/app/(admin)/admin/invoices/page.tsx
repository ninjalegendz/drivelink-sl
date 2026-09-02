import { redirect } from "next/navigation";

/** Retired: DriveLink does not invoice Rental Pages per booking. */
export default function AdminInvoicesPage() {
  redirect("/admin/analytics");
}
