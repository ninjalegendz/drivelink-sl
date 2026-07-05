import { redirect } from "next/navigation";

// The Action Inbox is now merged into the admin Home (/admin). Keep this route
// as a redirect so old links/bookmarks still land in the right place.
export default function AdminInboxRedirect() {
  redirect("/admin");
}
