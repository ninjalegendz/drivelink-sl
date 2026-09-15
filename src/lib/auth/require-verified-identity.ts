import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Nobody uses a DriveLink account until the person behind it has passed the
 * identity check, with a passport, NIC or driving licence. Browsing stays open
 * to everyone; this guards the signed-in parts: the account, bookings and the
 * Rental Page dashboard.
 *
 * It replaces a two-stage arrangement where identity was checked at signup-ish
 * time and a driving licence was reviewed separately before self-drive. The
 * licence review is gone, because the owner inspects the original licence at
 * the handover anyway, so a single identity check is now the whole gate.
 *
 * Read with the service client: kyc_status is a protected column a browser
 * session cannot select, and the session user pins the row to the caller.
 * Admins are exempt, since they run verification rather than undergo it here.
 */
export async function requireVerifiedIdentity(returnTo: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  const service = await createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("role, kyc_status")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as { role?: string; kyc_status?: string } | null;

  if (profile?.role === "admin") return;
  if (profile?.kyc_status === "verified") return;
  redirect(`/verify-identity?next=${encodeURIComponent(returnTo)}`);
}

/**
 * Where a person lands after signing in. Anyone not yet verified goes to the
 * identity check first, carrying the page they were heading for.
 */
export function landingAfterSignIn(role: string | undefined, kycStatus: string | undefined, intended: string): string {
  if (role === "admin") return "/admin";
  if (kycStatus !== "verified") return `/verify-identity?next=${encodeURIComponent(intended)}`;
  return intended;
}

/** Only same-site relative paths may be used as a post-verification return. */
export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
