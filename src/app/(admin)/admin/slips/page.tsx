import { redirect } from "next/navigation";

/** Retired with the manual bank-slip payment model. */
export default function AdminSlipsPage() {
  redirect("/admin/analytics");
}
