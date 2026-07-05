import { redirect } from "next/navigation";

// Superseded by the universal signup at /signup (Rental Pages revamp).
// Hosting is now set up afterwards from /account/pages/new. Kept as a
// redirect stub so old links/bookmarks don't 404.
export default function AgencySignupRedirect() {
  redirect("/signup");
}
