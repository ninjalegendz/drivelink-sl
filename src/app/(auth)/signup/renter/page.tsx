import { redirect } from "next/navigation";

// Superseded by the universal signup at /signup (Rental Pages revamp).
// Kept as a redirect stub so old links/bookmarks don't 404.
export default function RenterSignupRedirect() {
  redirect("/signup");
}
