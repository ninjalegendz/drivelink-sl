import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles Supabase auth redirects.
// Two flows land here:
//   1. Magic link click  → ?token_hash=...&type=magiclink   (or "email")
//   2. PKCE code exchange → ?code=...                       (OAuth-style)
// On success we route by role; ?next=<path> wins when present.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type");
  const code      = searchParams.get("code");
  const next      = searchParams.get("next");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type:       type as "magiclink" | "email" | "recovery" | "signup" | "invite",
    });
    if (error) {
      console.error("[auth/callback] verifyOtp", error.message);
      return NextResponse.redirect(`${origin}/login?error=link_invalid`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession", error.message);
      return NextResponse.redirect(`${origin}/login?error=link_invalid`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  // If this callback was the "verify your email for a badge" link, stamp
  // email_verified_at on the profile while we're authenticated as them.
  if (searchParams.get("verify_email") === "1") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ email_verified_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  }

  // Success, figure out where to send them.
  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;

  const dest =
    role === "admin"        ? "/admin" :
    role === "agency_owner" ? "/dashboard" :
                              "/";
  return NextResponse.redirect(`${origin}${dest}`);
}
