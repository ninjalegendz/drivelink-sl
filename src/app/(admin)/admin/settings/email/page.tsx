import { createClient } from "@/lib/supabase/server";
import { Mail } from "lucide-react";
import { EmailConfigForm } from "@/components/admin/EmailConfigForm";

export default async function AdminEmailSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_config")
    .select("from_name, from_email, resend_api_key, updated_at")
    .eq("id", true)
    .single();

  // resend_api_key value is intentionally not surfaced back into the form —
  // we just need to know whether one is set so the form can label the field
  // "leave blank to keep existing".
  const raw = (data ?? null) as {
    from_name:       string;
    from_email:      string | null;
    resend_api_key:  string | null;
    updated_at:      string;
  } | null;

  const apiKeySet = Boolean(raw?.resend_api_key);
  const configured = Boolean(raw?.from_email && apiKeySet);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <Mail size={24} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Email setup</h1>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Resend API key used to send verification codes, booking notifications,
        and renter/agency emails. The API key is write-only — leave the field
        blank to keep the existing one.
      </p>

      {/* Status banner */}
      <div
        className={`mb-6 px-4 py-3 rounded-xl border text-sm ${
          configured
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            : "bg-amber-500/10 border-amber-500/20 text-amber-300"
        }`}
      >
        {configured ? (
          <>
            <strong className="font-semibold">Active.</strong>{" "}
            Sending from <span className="font-mono">{raw!.from_email}</span>.
            Last updated {new Date(raw!.updated_at).toLocaleString("en-LK")}.
          </>
        ) : (
          <>
            <strong className="font-semibold">Not configured.</strong>{" "}
            Email features fall back to console logs until you save an API key below.
          </>
        )}
      </div>

      {/* Resend-specific guidance */}
      <details className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm">
        <summary className="text-white font-medium cursor-pointer select-none">
          New to Resend? One-time setup
        </summary>
        <ol className="text-slate-400 text-xs mt-3 space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li>Sign up at <span className="font-mono text-slate-300">resend.com</span> with your work email.</li>
          <li>Add <span className="font-mono text-slate-300">drivelink.lk</span> as a domain.</li>
          <li>Add the DNS records Resend gives you (SPF, DKIM, DMARC) at your DNS provider — verification usually takes 5-30 minutes.</li>
          <li>Once verified, go to API Keys → <strong>Create API Key</strong> → name it &quot;DriveLink production&quot; → copy the <span className="font-mono text-slate-300">re_...</span> string.</li>
          <li>Paste that key below + set <strong>From email</strong> to an address on your verified domain (e.g. <span className="font-mono text-slate-300">noreply@drivelink.lk</span>) → Save → Send test.</li>
        </ol>
      </details>

      <EmailConfigForm
        initial={{
          from_name:  raw?.from_name  ?? "DriveLink SL",
          from_email: raw?.from_email ?? "",
        }}
        apiKeySet={apiKeySet}
      />
    </div>
  );
}
