import type { Metadata } from "next";
import Link from "next/link";
import { Siren, Phone, Camera, FileText, HandCoins } from "lucide-react";
import { pageShellClass } from "@/components/ui/PageShell";
import { ContentHero } from "@/components/content/ContentHero";
import { Prose } from "@/components/content/Prose";
import { StepList, type Step } from "@/components/content/StepList";
import { Callout } from "@/components/content/Callout";

export const metadata: Metadata = {
  title: "Accident or breakdown? Do this | DriveLink",
  description:
    "What to do after an accident or breakdown in Sri Lanka: police report, insurer requirements, and what not to do at the roadside.",
};

// Written to be read in a stressful moment: short imperatives first, reasons
// after. This is advice, not a process DriveLink runs. Who ends up paying for
// what depends on the owner's insurance and what the two of them agreed, so
// the page is careful never to promise a limit on anyone's liability.
const STEPS: Step[] = [
  {
    icon: <Siren size={16} />,
    title: "Safety first",
    body: "Hazard lights on. Move people away from traffic. Only move the vehicles if police tell you to, or if it's a minor scrape and both drivers agree. Insurers can reject claims when the scene was changed.",
  },
  {
    icon: <Phone size={16} />,
    title: "Call the police: 119",
    body: "Do not leave without a police report number. Sri Lankan insurers require a police report for accident claims; without one the damage usually becomes a personal cost.",
  },
  {
    icon: <Phone size={16} />,
    title: "Call the owner now",
    body: "Their number is on your booking page. The owner is the one who deals with their insurer, so they need to know immediately. Call, do not only message.",
  },
  {
    icon: <Camera size={16} />,
    title: "Photograph everything",
    body: "The scene from several angles, both vehicles, both number plates, licences of everyone involved, and the road. More photos beat fewer.",
  },
  {
    icon: <HandCoins size={16} />,
    title: "Do not settle in cash at the roadside",
    body: "And do not admit fault. Roadside 'settle it now' pressure is common. Money handed over at the scene is unrecoverable and can void the insurance path entirely.",
  },
  {
    icon: <FileText size={16} />,
    title: "Report it on DriveLink",
    body: "Open the booking and use Report a problem. Attach the photos and the police report number. This timestamps what happened while it is fresh, which matters if anyone remembers it differently later.",
  },
];

export default function AccidentProtocolPage() {
  return (
    <div className={pageShellClass("prose", "space-y-8 print:py-4")}>
      <ContentHero
        eyebrow="Keep this handy on every trip"
        title="Accident or breakdown? Do this."
        lead="Six steps, in order. Following them protects you, the owner's insurance claim, and your own position if there is a disagreement afterwards. Worth reading once before a trip rather than for the first time at the roadside."
      />

      <StepList steps={STEPS} />

      <Prose>
        <section id="breakdowns">
          <h2>Breakdowns (not your fault)</h2>
          <p>
            If a mechanical failure was not caused by you, call the owner and agree what happens next:
            repair, recovery, a replacement vehicle, or money back for the days you cannot use it. Owners
            differ enormously in what they can offer, and DriveLink does not arrange any of it, so ask
            before you book if it matters to you.
          </p>
          <Callout tone="warning" title="Get it in writing first" className="mt-4">
            Never authorise repairs without the owner&apos;s written OK in the booking chat, or you may be
            paying for them yourself. Record who authorised and who paid for any towing.
          </Callout>
        </section>

        <section id="who-pays">
          <h2>Who pays, and why to ask first</h2>
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
      </Prose>

      <footer className="text-sm text-slate-500">
        Emergency numbers: Police <strong>119</strong>, Ambulance <strong>1990</strong>. Your booking
        and the owner&apos;s contact details are at{" "}
        <Link href="/bookings" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">
          drivelink.lk/bookings
        </Link>
        .
      </footer>
    </div>
  );
}
