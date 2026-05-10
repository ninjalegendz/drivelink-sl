import { createClient } from "@/lib/supabase/server";
import { Mail } from "lucide-react";
import { EmailConfigForm } from "@/components/admin/EmailConfigForm";

export default async function AdminEmailSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_config")
    .select("from_name, from_email, smtp_host, smtp_port, smtp_username, updated_at")
    .eq("id", true)
    .single();

  // smtp_password is intentionally NOT selected — we never display it back to
  // admins. The form renders an empty password field; leaving it empty keeps
  // the existing password unchanged.
  const cfg = (data ?? null) as {
    from_name: string;
    from_email: string | null;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string | null;
    updated_at: string;
  } | null;

  const configured = Boolean(cfg?.smtp_username && cfg?.from_email);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <Mail size={24} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Email setup</h1>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        SMTP credentials shared by all admins. Used to send verification codes,
        booking notifications, and renter/agency emails. Stored encrypted at rest;
        the password field is write-only — leave it blank to keep the existing one.
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
            Sending from <span className="font-mono">{cfg!.from_email}</span>.
            Last updated {new Date(cfg!.updated_at).toLocaleString("en-LK")}.
          </>
        ) : (
          <>
            <strong className="font-semibold">Not configured.</strong>{" "}
            Email features fall back to console logs until you save credentials below.
          </>
        )}
      </div>

      {/* Gmail-specific guidance */}
      <details className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm">
        <summary className="text-white font-medium cursor-pointer select-none">
          Using Gmail? Generate an app password
        </summary>
        <ol className="text-slate-400 text-xs mt-3 space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li>Turn on 2-Step Verification on the Google account.</li>
          <li>Visit <span className="font-mono text-slate-300">myaccount.google.com/apppasswords</span>.</li>
          <li>App = &quot;Mail&quot;, Device = &quot;Other (DriveLink)&quot;, click <strong>Generate</strong>.</li>
          <li>Copy the 16-character password (no spaces) into the password field below.</li>
          <li>Username = full Gmail address. Host = <span className="font-mono">smtp.gmail.com</span>, Port = <span className="font-mono">587</span>.</li>
        </ol>
      </details>

      <EmailConfigForm
        initial={{
          from_name:     cfg?.from_name      ?? "DriveLink SL",
          from_email:    cfg?.from_email     ?? "",
          smtp_host:     cfg?.smtp_host      ?? "smtp.gmail.com",
          smtp_port:     cfg?.smtp_port      ?? 587,
          smtp_username: cfg?.smtp_username  ?? "",
        }}
        passwordSet={configured}
      />
    </div>
  );
}
