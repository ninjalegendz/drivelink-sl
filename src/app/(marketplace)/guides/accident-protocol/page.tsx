import type { Metadata } from "next";
import Link from "next/link";
import { Siren, Phone, Camera, ShieldAlert, FileText, HandCoins } from "lucide-react";

export const metadata: Metadata = {
  title: "Accident or breakdown? Do this | DriveLink",
  description:
    "The step-by-step protocol for an accident or breakdown in a DriveLink rental in Sri Lanka: police report, insurer requirements, and what NOT to do at the roadside.",
};

// Referenced by the rental agreement's liability section and the
// in-booking "Report a problem" flow. Static, printable, and written to
// be read in a stressful moment: short imperatives first, reasons after.
const STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Siren size={18} />,
    title: "1. Safety first",
    body: "Hazard lights on. Move people away from traffic. Only move the vehicles if police tell you to, or if it's a minor scrape and both drivers agree — insurers can reject claims when the scene was changed.",
  },
  {
    icon: <Phone size={18} />,
    title: "2. Call the police — 119",
    body: "Do not leave without a police report number. Sri Lankan insurers require a police report for accident claims; without one the damage usually becomes a personal cost.",
  },
  {
    icon: <Phone size={18} />,
    title: "3. Call the owner now",
    body: "Their number is on your booking page and in the rental agreement. The owner deals with their insurer — you deal with the owner, through the booking.",
  },
  {
    icon: <Camera size={18} />,
    title: "4. Photograph everything",
    body: "The scene from several angles, both vehicles, both number plates, licences of everyone involved, and the road. More photos beat fewer.",
  },
  {
    icon: <HandCoins size={18} />,
    title: "5. Do not settle in cash at the roadside",
    body: "And do not admit fault. Roadside 'settle it now' pressure is common — money handed over at the scene is unrecoverable and can void the insurance path entirely.",
  },
  {
    icon: <FileText size={18} />,
    title: "6. Report it on DriveLink",
    body: "Open the booking → Report a problem → Accident (or Breakdown). Attach the photos and the police report number. This timestamps everything and brings in the DriveLink team.",
  },
];

export default function AccidentProtocolPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 print:py-4">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-red-600 text-sm font-semibold">
          <ShieldAlert size={16} /> Keep this handy on every trip
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Accident or breakdown? Do this.</h1>
        <p className="text-slate-600 leading-relaxed">
          Six steps, in order. Every DriveLink rental agreement includes this protocol — following it
          protects your deposit, the owner&apos;s insurance claim, and you.
        </p>
      </header>

      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <span className="text-blue-600 shrink-0 mt-0.5">{s.icon}</span>
            <div>
              <h2 className="font-semibold text-slate-900">{s.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed mt-1">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-sm text-slate-600 leading-relaxed">
        <h2 className="font-semibold text-slate-900 text-base">Breakdowns (not your fault)</h2>
        <p>
          Mechanical failure that isn&apos;t caused by the renter is the <strong>owner&apos;s</strong>{" "}
          responsibility: repair, a replacement vehicle, or a refund for the lost days. Report it through
          the booking and give the owner a chance to respond — but{" "}
          <strong>never authorise repairs yourself without the owner&apos;s written OK</strong> in the
          conversation, or the cost may not be reimbursed. Towing for a mechanical failure is the
          owner&apos;s cost.
        </p>
        <h2 className="font-semibold text-slate-900 text-base pt-2">What you're liable for</h2>
        <p>
          With a properly hire-insured vehicle, your exposure in an at-fault accident is normally the
          insurance excess plus anything the insurer excludes — as written in your rental agreement.{" "}
          <strong>Breaching the agreement changes that to full liability</strong>: an unlisted driver at
          the wheel, alcohol or drugs, prohibited-use trips, or driving without a valid licence/permit.
        </p>
      </section>

      <footer className="text-sm text-slate-500">
        Emergency numbers: Police <strong>119</strong> · Ambulance <strong>1990</strong>. Your booking,
        agreement and owner contact are at{" "}
        <Link href="/bookings" className="text-blue-600 hover:underline">
          drivelink.lk/bookings
        </Link>
        .
      </footer>
    </div>
  );
}
