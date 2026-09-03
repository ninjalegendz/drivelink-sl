import type { Metadata } from "next";
import Link from "next/link";
import { Siren, Phone, Camera, ShieldAlert, FileText, HandCoins } from "lucide-react";
import { pageShellClass } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Accident or breakdown? Do this | DriveLink",
  description:
    "What to do after an accident or breakdown in Sri Lanka: police report, insurer requirements, and what not to do at the roadside.",
};

// Written to be read in a stressful moment: short imperatives first, reasons
// after. This is advice, not a process DriveLink runs. Who ends up paying for
// what depends on the owner's insurance and what the two of them agreed, so
// the page is careful never to promise a limit on anyone's liability.
const STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Siren size={18} />,
    title: "1. Safety first",
    body: "Hazard lights on. Move people away from traffic. Only move the vehicles if police tell you to, or if it's a minor scrape and both drivers agree. Insurers can reject claims when the scene was changed.",
  },
  {
    icon: <Phone size={18} />,
    title: "2. Call the police: 119",
    body: "Do not leave without a police report number. Sri Lankan insurers require a police report for accident claims; without one the damage usually becomes a personal cost.",
  },
  {
    icon: <Phone size={18} />,
    title: "3. Call the owner now",
    body: "Their number is on your booking page. The owner is the one who deals with their insurer, so they need to know immediately. Call, do not only message.",
  },
  {
    icon: <Camera size={18} />,
    title: "4. Photograph everything",
    body: "The scene from several angles, both vehicles, both number plates, licences of everyone involved, and the road. More photos beat fewer.",
  },
  {
    icon: <HandCoins size={18} />,
    title: "5. Do not settle in cash at the roadside",
    body: "And do not admit fault. Roadside 'settle it now' pressure is common. Money handed over at the scene is unrecoverable and can void the insurance path entirely.",
  },
  {
    icon: <FileText size={18} />,
    title: "6. Report it on DriveLink",
    body: "Open the booking and use Report a problem. Attach the photos and the police report number. This timestamps what happened while it is fresh, which matters if anyone remembers it differently later.",
  },
];

export default function AccidentProtocolPage() {
  return (
    <div className={pageShellClass("prose", "space-y-8 print:py-4")}>
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-red-600 text-sm font-semibold">
          <ShieldAlert size={16} /> Keep this handy on every trip
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Accident or breakdown? Do this.</h1>
        <p className="text-slate-600 leading-relaxed">
          Six steps, in order. Following them protects you, the owner&apos;s insurance claim, and your
          own position if there is a disagreement afterwards. Worth reading once before a trip rather
          than for the first time at the roadside.
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
          If a mechanical failure was not caused by you, call the owner and agree what happens next:
          repair, recovery, a replacement vehicle, or money back for the days you cannot use it. Owners
          differ enormously in what they can offer, and DriveLink does not arrange any of it, so ask
          before you book if it matters to you. Whatever you agree,{" "}
          <strong>never authorise repairs without the owner&apos;s written OK</strong> in the booking
          chat, or you may be paying for them yourself. Record who authorised and who paid for any towing.
        </p>
        <h2 className="font-semibold text-slate-900 text-base pt-2">Who pays, and why to ask first</h2>
        <p>
          There is no standard answer, and DriveLink does not set one. What you owe after an at-fault
          accident depends on the owner&apos;s insurance policy and on what the two of you agreed before
          you drove away. Ask the owner directly, before you take the keys: whether the vehicle carries
          hire insurance, what the excess is, and what they expect from you if something happens.
        </p>
        <p>
          Some things put the cost on you almost anywhere: someone driving who was never named, alcohol
          or drugs, driving without a valid licence or permit, or taking the vehicle somewhere the owner
          told you not to. Insurers refuse claims for all of them.
        </p>
      </section>

      <footer className="text-sm text-slate-500">
        Emergency numbers: Police <strong>119</strong> · Ambulance <strong>1990</strong>. Your booking
        and the owner&apos;s contact details are at{" "}
        <Link href="/bookings" className="text-blue-600 hover:underline">
          drivelink.lk/bookings
        </Link>
        .
      </footer>
    </div>
  );
}
