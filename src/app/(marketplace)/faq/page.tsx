"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, Plus } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { siteConfig, whatsappLink } from "@/lib/site-config";

interface QA {
  q: string;
  a: React.ReactNode;
}

const RENTER_FAQS: QA[] = [
  {
    q: "How does booking work?",
    a: (
      <>
        Pick a vehicle, choose your dates, and send a free request. We verify your details
        (including your licence for self-drive), and the provider confirms availability. Once
        approved, the provider&apos;s contact details unlock so you can call or WhatsApp them to
        arrange the handover. You pay the rental directly to the provider on pickup.
      </>
    ),
  },
  {
    q: "Is there any fee to book?",
    a: (
      <>
        No. During our launch period there are no DriveLink booking fees and no down payment.
        You pay the rental cost, plus any refundable deposit, directly to the provider on
        handover, at the listed local price.
      </>
    ),
  },
  {
    q: "Do I need a special licence to drive in Sri Lanka?",
    a: (
      <>
        For <strong>self-drive</strong>, foreign visitors generally need an{" "}
        <strong>International Driving Permit (IDP)</strong> validated locally (a recognition
        permit from the AA of Sri Lanka or the Department of Motor Traffic). Many providers help
        arrange this. Look for the <strong>Tourist Friendly</strong> badge. If you&apos;d rather
        not deal with permits, choose a <strong>with-driver</strong> listing instead.
      </>
    ),
  },
  {
    q: "What's the difference between self-drive and with-driver?",
    a: (
      <>
        <strong>Self-drive</strong> means you drive yourself, so you&apos;ll usually need an IDP with
        a Sri Lankan endorsement. <strong>With-driver</strong> means a professional local driver
        takes you around, which is ideal for tours, groups, and travellers who&apos;d rather not
        drive. Many listings offer both, plus airport pickup.
      </>
    ),
  },
  {
    q: "How does the deposit work?",
    a: (
      <>
        Some vehicles need a <strong>refundable security deposit</strong>, shown on the listing
        and on the booking screen before you confirm. It&apos;s held by the provider (not
        DriveLink) and returned after you bring the vehicle back in the same condition. Many
        with-driver listings need no deposit at all.
      </>
    ),
  },
  {
    q: "What about insurance, accidents, and damage?",
    a: (
      <>
        We label each vehicle as <strong>Hire-insured</strong> (commercially insured for rental,
        the safer choice) or <strong>Private (P-Number)</strong> (the owner&apos;s personal
        insurance, which may not cover rental use). Excess, deposits, and damage handling are
        agreed directly with the provider before pickup. Always confirm the terms in writing,
        and take photos of the vehicle&apos;s condition at handover and return.
      </>
    ),
  },
  {
    q: "How and when do I pay?",
    a: (
      <>
        You pay the <strong>provider directly</strong>, typically in cash or by bank transfer on
        the day of pickup, per the terms you agree. DriveLink doesn&apos;t take payment during the
        launch period, so there&apos;s nothing to pay us.
      </>
    ),
  },
  {
    q: "Can I get a vehicle at the airport?",
    a: (
      <>
        Yes. Filter for <strong>Airport Pickup</strong> to see providers who collect you at
        Bandaranaike International (CMB) or drop you off there. Add your flight details in the
        request notes so the provider can plan around your arrival time.
      </>
    ),
  },
  {
    q: "What if I need to change or cancel a booking?",
    a: (
      <>
        Before a provider confirms, you can cancel free with no penalty. After confirmation,
        message the provider as early as possible. Late or repeated cancellations affect your
        reliability score. Need help? WhatsApp us with your booking reference.
      </>
    ),
  },
  {
    q: "Is the provider's phone number hidden until later?",
    a: (
      <>
        Yes. We show the provider&apos;s name, city, and reliability stats publicly so you can
        decide, but the contact number unlocks only after your details are verified and the
        provider confirms the booking. This keeps listings trustworthy for everyone.
      </>
    ),
  },
];

const AGENCY_FAQS: QA[] = [
  {
    q: "What does it cost to list?",
    a: (
      <>
        Nothing, listing is free forever. Listing vehicles, receiving requests, and using the
        dashboard cost nothing. During launch there is also <strong>zero commission</strong> on
        bookings. No monthly fee, no per-listing fee, no surprises.
      </>
    ),
  },
  {
    q: "How do I get paid?",
    a: (
      <>
        Renters pay you <strong>directly</strong>. DriveLink does not hold or process the money.
        You agree the rental amount, deposit, and method (cash or bank transfer) with the renter
        once the booking is confirmed and their contact is unlocked. Set your own payment terms
        on the listing.
      </>
    ),
  },
  {
    q: "How do I know a renter is real?",
    a: (
      <>
        Every renter completes ID verification (Didit). Their verification status and reliability
        score show on each request, so you can spot renters who have cancelled late or ghosted in
        the past. You can decline any request with no penalty.
      </>
    ),
  },
  {
    q: "What are verification badges and how do I get them?",
    a: (
      <>
        Badges like <strong>Verified Owner</strong>, <strong>Documents Checked</strong>, and{" "}
        <strong>Tourist Friendly</strong> are assigned by our admin team after we review your ID
        and vehicle documents. Verified, fast-responding Rental Pages rank higher and get more
        bookings. Submit clear photos, accurate info, and a valid insurance certificate to qualify.
      </>
    ),
  },
  {
    q: "What documents do I need to list a vehicle?",
    a: (
      <>
        Have your vehicle <strong>registration (CR)</strong> and a valid <strong>insurance
        certificate</strong> ready. Take clear photos of the vehicle&apos;s exterior, interior,
        odometer, and any distinguishing features. Hire-insured vehicles get stronger trust badges
        and better visibility. We also verify your ID via Didit.
      </>
    ),
  },
  {
    q: "How do I get booking requests?",
    a: (
      <>
        The moment a renter sends a request, we alert you via SMS on the number you registered
        with. The SMS includes the vehicle, dates, renter name, and a link to your dashboard.
        Confirm or decline from there. Everything works from your dashboard; no separate app needed.
      </>
    ),
  },
  {
    q: "Should I offer self-drive, with-driver, or both?",
    a: (
      <>
        Offering both widens your reach and bookings. Tourists who can&apos;t arrange an
        International Driving Permit will book <strong>with-driver</strong>; confident drivers and
        longer trips prefer <strong>self-drive</strong>. Adding <strong>airport pickup</strong>{" "}
        captures arriving travellers. You choose which options each vehicle supports when you list it.
      </>
    ),
  },
  {
    q: "What if my listing isn't approved?",
    a: (
      <>
        New listings go through a quick admin review. Common reasons for rejection: unclear photos,
        missing information, or unrealistic pricing. We email you the specific feedback so you can
        fix it and resubmit. Most approvals take 1-2 days.
      </>
    ),
  },
  {
    q: "Can I cancel after confirming?",
    a: (
      <>
        You can, but it counts against your reliability score and ranking. Cancellations close to
        the renter&apos;s pickup date harm your score most. Keep your availability accurate to
        avoid cancellations. Repeated cancellations may result in penalties or ranking reductions.
      </>
    ),
  },
];

type TabKey = "renters" | "agencies";

function AccordionItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="spring-press w-full text-left px-5 py-4 flex items-start justify-between gap-3"
      >
        <span className="text-slate-900 font-medium text-sm">{q}</span>
        <Plus
          size={16}
          className={`text-slate-500 shrink-0 mt-0.5 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="text-slate-600 text-sm leading-relaxed px-5 pb-4 pt-3 border-t border-slate-200">
            {a}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [tab, setTab] = useState<TabKey>("renters");
  const items = tab === "renters" ? RENTER_FAQS : AGENCY_FAQS;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-3">
          <HelpCircle size={20} className="text-blue-600" />
          <span className="text-blue-700 text-xs font-semibold uppercase tracking-wider">FAQ</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Frequently asked questions</h1>
      </header>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 justify-center mb-8 p-1 bg-white border border-slate-200 rounded-full w-fit mx-auto shadow-sm">
        {([
          { key: "renters",  label: "For renters" },
          { key: "agencies", label: "For Rental Page owners" },
        ] as const).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`spring-press px-5 py-2 rounded-full text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 animate-fade-up" key={tab}>
        {items.map((item, i) => (
          <AccordionItem key={`${tab}-${i}`} q={item.q} a={item.a} />
        ))}
      </div>

      {/* Still have questions → WhatsApp */}
      <div className="text-center mt-12 p-6 bg-slate-900 text-white rounded-2xl">
        <p className="font-display text-lg font-extrabold">Still have a question?</p>
        <p className="text-slate-300 text-sm mt-1 mb-4">
          Message our team on WhatsApp. We usually reply within minutes.
        </p>
        <a
          href={whatsappLink("Hi DriveLink, I have a question about ")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <WhatsAppIcon size={16} /> WhatsApp {siteConfig.whatsappDisplay}
        </a>
      </div>
    </div>
  );
}
