import Link from "next/link";
import { HelpCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — DriveLink SL",
  description: "Common questions about renting a car and listing your fleet on DriveLink SL.",
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const RENTER_FAQS: QA[] = [
  {
    q: "How does booking work?",
    a: (
      <>
        Pick a vehicle, choose your dates, and send a free request. The agency confirms or
        declines within a few hours. If they confirm, you pay a Rs. 500 lock-in fee (via bank
        transfer) within 12 hours to secure the booking. Once we verify your payment, the
        agency&apos;s contact details unlock and you can call/WhatsApp/SMS them to arrange pickup.
      </>
    ),
  },
  {
    q: "What does the Rs. 500 cover?",
    a: (
      <>
        It&apos;s a lock-in fee — it secures the vehicle for your dates and locks in the price
        the agency quoted. It&apos;s separate from the rental cost itself, which you pay directly
        to the agency at pickup. If the agency cancels after confirming, you get the Rs. 500
        back in full.
      </>
    ),
  },
  {
    q: "Do I need to verify my ID?",
    a: (
      <>
        Yes. ID verification through Didit (our third-party verifier) takes about 2 minutes.
        Verified renters get confirmed faster by agencies and unlock all bookings. Some
        agencies may not accept unverified renters at all.
      </>
    ),
  },
  {
    q: "What happens if I cancel?",
    a: (
      <>
        Cancellations before the agency confirms are free — no charge, no reliability hit.
        Cancellations after the agency confirms cost you a reliability score reduction (the
        closer to pickup, the bigger the hit). Repeat last-minute cancellations get your account
        flagged.
      </>
    ),
  },
  {
    q: "What if I don&apos;t pay the Rs. 500 within 12 hours?",
    a: (
      <>
        The booking auto-cancels. The slot is freed up for someone else and your reliability
        score takes a hit. We&apos;ll text and email you to remind you before that happens.
      </>
    ),
  },
  {
    q: "Is the agency&apos;s phone number hidden until I pay?",
    a: (
      <>
        Yes. We show the agency&apos;s name, city, and reliability stats publicly so you can
        decide, but the contact number is unlocked only after the booking is confirmed AND the
        Rs. 500 is verified. This protects against off-platform bypass and ensures both sides
        have skin in the game.
      </>
    ),
  },
  {
    q: "What about insurance and damages?",
    a: (
      <>
        Insurance is between you and the agency. We surface whether the vehicle is{" "}
        <strong>Hire-insured</strong> (commercially insured for rental — safer) or{" "}
        <strong>Private (P-Number)</strong> (owner&apos;s personal insurance, which may not cover
        rental usage). Damage handling, deposits, and excess are all directly negotiated with
        the agency before pickup. Always confirm in writing.
      </>
    ),
  },
];

const AGENCY_FAQS: QA[] = [
  {
    q: "What does it cost to list?",
    a: (
      <>
        Nothing. Listing vehicles, receiving requests, and using the dashboard is free. We
        charge a flat Rs. 200 per booking that completes successfully — billed monthly,
        invoiced via the admin team. No monthly subscription, no per-listing fee.
      </>
    ),
  },
  {
    q: "When do I pay the Rs. 200?",
    a: (
      <>
        Only after a booking reaches &quot;completed&quot; status — meaning the renter picked
        up the vehicle, the rental period ended, and you marked it complete in your dashboard.
        Declines, cancellations, no-shows, and incomplete bookings are all free.
      </>
    ),
  },
  {
    q: "How do I know a renter is real?",
    a: (
      <>
        Every renter goes through ID verification (Didit, third-party). Their verification
        status and reliability score are visible on every booking request. Renters who&apos;ve
        cancelled bookings late or ghosted in the past show a lower reliability score — you can
        decline with no penalty.
      </>
    ),
  },
  {
    q: "How do I get notified about bookings?",
    a: (
      <>
        We text you on the mobile number you registered with. The SMS includes the booking
        reference, vehicle, dates, and a link to your dashboard where you confirm or decline.
        You don&apos;t need a smartphone app — everything works over the dashboard URL.
      </>
    ),
  },
  {
    q: "What if my listing isn&apos;t approved?",
    a: (
      <>
        New listings go through admin review (usually within 24 hours). The most common rejection
        reasons are unclear photos, missing required information, or pricing that looks
        unreasonable. We&apos;ll message you with feedback so you can fix and resubmit.
      </>
    ),
  },
  {
    q: "Can I cancel after confirming?",
    a: (
      <>
        You can, but it counts against your agency&apos;s reliability score and may incur a
        penalty if it&apos;s within 24 hours of the renter&apos;s pickup date. Repeated late
        cancellations get your account flagged and lower search ranking.
      </>
    ),
  },
];

function Section({ title, items, anchor }: { title: string; items: QA[]; anchor: string }) {
  return (
    <section id={anchor} className="mb-12">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="group bg-slate-900 border border-slate-200 rounded-2xl shadow-sm px-5 py-4 [&_summary::marker]:hidden [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="cursor-pointer flex items-start justify-between gap-3 list-none">
              <span className="text-white font-medium text-sm">{item.q}</span>
              <span className="text-slate-500 group-open:rotate-45 transition-transform shrink-0 mt-0.5">+</span>
            </summary>
            <div className="text-slate-300 text-sm leading-relaxed mt-3 pt-3 border-t border-slate-800">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-3">
          <HelpCircle size={20} className="text-amber-400" />
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">FAQ</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Frequently asked questions</h1>
      </header>

      <div className="flex gap-2 justify-center mb-10">
        <a href="#renters"  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-full transition-colors">For renters</a>
        <a href="#agencies" className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-full transition-colors">For agencies</a>
      </div>

      <Section title="For renters"  items={RENTER_FAQS} anchor="renters" />
      <Section title="For agencies" items={AGENCY_FAQS} anchor="agencies" />

      <div className="text-center mt-12 p-6 bg-slate-900 border border-slate-200 rounded-2xl shadow-sm">
        <p className="text-white font-medium">Still have a question?</p>
        <p className="text-slate-500 text-sm mt-1">
          Agencies can message DriveLink support directly from{" "}
          <Link href="/dashboard/support" className="text-amber-400 hover:text-amber-300">your dashboard</Link>.
        </p>
      </div>
    </div>
  );
}
