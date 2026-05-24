import { Mail } from "lucide-react";
import { EmailTestSender } from "@/components/admin/EmailTestSender";

export default function AdminEmailSettingsPage() {
  // Email creds live in env vars now (RESEND_API_KEY / RESEND_FROM_EMAIL /
  // RESEND_FROM_NAME), not the database — set them in Vercel / Cloudflare
  // Pages dashboard and redeploy to rotate. This page is a thin status +
  // test-send so admins can verify the env is wired without poking SSH/logs.
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? null;
  const fromName  = process.env.RESEND_FROM_NAME  ?? "DriveLink SL";
  const configured = Boolean(process.env.RESEND_API_KEY && fromEmail);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <Mail size={24} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Email setup</h1>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Transactional email goes through Resend over HTTPS. Credentials are
        configured via env vars on the host (Vercel / Cloudflare Pages) and
        rotated by redeploying — there&apos;s no UI to edit them here.
      </p>

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
            Sending from <span className="font-mono">{fromName} &lt;{fromEmail}&gt;</span>.
          </>
        ) : (
          <>
            <strong className="font-semibold">Not configured.</strong>{" "}
            Set <span className="font-mono">RESEND_API_KEY</span>,{" "}
            <span className="font-mono">RESEND_FROM_EMAIL</span>, and{" "}
            <span className="font-mono">RESEND_FROM_NAME</span> in your hosting env
            and redeploy. Emails fall back to console logs until then.
          </>
        )}
      </div>

      <details className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm">
        <summary className="text-white font-medium cursor-pointer select-none">
          Resend setup checklist
        </summary>
        <ol className="text-slate-400 text-xs mt-3 space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li>Sign up at <span className="font-mono text-slate-300">resend.com</span>.</li>
          <li>Add <span className="font-mono text-slate-300">drivelink.lk</span> as a domain.</li>
          <li>Add the SPF + DKIM + DMARC DNS records they provide at your DNS host.</li>
          <li>Wait for verification (5-30 min), then create an API key.</li>
          <li>Set <span className="font-mono text-slate-300">RESEND_API_KEY=re_...</span>,{" "}
              <span className="font-mono text-slate-300">RESEND_FROM_EMAIL=noreply@drivelink.lk</span>,{" "}
              and <span className="font-mono text-slate-300">RESEND_FROM_NAME=DriveLink SL</span> in your hosting env.</li>
          <li>Redeploy. Send a test below to verify.</li>
        </ol>
      </details>

      <EmailTestSender disabled={!configured} />
    </div>
  );
}
