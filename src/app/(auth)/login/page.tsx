"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      const msg = authError.message;
      if (msg.includes("Email not confirmed"))
        setError("Please confirm your email first — check your inbox for a verification link.");
      else if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials"))
        setError("Incorrect email or password. Please try again.");
      else
        setError(msg);
      return;
    }

    // Honour an explicit `next` redirect (e.g. a user hit a protected page first).
    // Otherwise route by role: admin → /admin, agency_owner → /dashboard, renter → /.
    let dest = next;
    if (!dest) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = (profile as { role?: string } | null)?.role;
        dest =
          role === "admin"        ? "/admin" :
          role === "agency_owner" ? "/dashboard" :
                                    "/";
      } else {
        dest = "/";
      }
    }

    setLoading(false);
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
      <h1 className="text-white font-bold text-xl mb-1">Sign in</h1>
      <p className="text-slate-400 text-sm mb-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-amber-400 hover:text-amber-300">Sign up</Link>
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign in
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
