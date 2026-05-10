"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function friendlyAuthError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("already exists"))
    return "This email address is already registered. Sign in instead.";
  if (msg.includes("Database error") || msg.includes("saving new user"))
    return "This phone number is already in use. Please use a different number.";
  if (msg.includes("Password should be") || msg.includes("password"))
    return "Password must be at least 8 characters.";
  if (msg.includes("Invalid email"))
    return "Please enter a valid email address.";
  if (msg.includes("Signup requires a valid password"))
    return "Please choose a password of at least 8 characters.";
  return msg;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "agency" ? "agency_owner" : "renter";

  const [fullName, setFullName]       = useState("");
  const [agencyName, setAgencyName]   = useState("");
  const [phone, setPhone]             = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [sentTo, setSentTo]           = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, role, agency_name: agencyName || undefined },
      },
    });

    if (authError) {
      setError(friendlyAuthError(authError.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push(role === "agency_owner" ? "/signup/agency" : "/vehicles");
      return;
    }

    setLoading(false);
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Mail size={32} className="text-amber-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
          We sent a confirmation link to{" "}
          <span className="text-white font-medium">{sentTo}</span>.
          Click the link to activate your account and then sign in.
        </p>
        <p className="text-slate-500 text-xs mt-5">Didn&apos;t get it? Check your spam folder.</p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
      <h1 className="text-white font-bold text-xl mb-1">
        {role === "agency_owner" ? "List your fleet" : "Create account"}
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-400 hover:text-amber-300">Sign in</Link>
      </p>

      {role === "agency_owner" && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-amber-400 text-xs font-medium">
            Listing your fleet is free. We only earn when a renter books through us.
          </p>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Your full name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="Your legal full name" />
        </div>

        {role === "agency_owner" && (
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Agency / business name</label>
            <input type="text" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
              placeholder="e.g. Perera Car Rentals" />
          </div>
        )}

        <div>
          <label className="text-slate-400 text-xs mb-1 block">WhatsApp number</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="0771234567" />
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="you@example.com" />
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            placeholder="Min. 8 characters" />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {role === "agency_owner" ? (
            <span className="inline-flex items-center gap-1.5">Create agency account <ArrowRight size={16} /></span>
          ) : "Create account"}
        </Button>

        <p className="text-slate-500 text-xs text-center">
          By signing up you agree to our Terms of Service.
        </p>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
