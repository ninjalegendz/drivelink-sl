import Link from "next/link";
import Image from "next/image";
import { Banknote, Camera, Receipt } from "lucide-react";

// The three facts already stated across the marketplace (footer, pricing,
// deposit explanation) that make a first-time renter or owner comfortable
// enough to hand over their phone number and, later, an ID photo.
const REASSURANCES = [
  { Icon: Receipt,  text: "Booking requests cost Rs. 0." },
  { Icon: Banknote, text: "Deposits are paid to the host. DriveLink does not hold them." },
  { Icon: Camera,   text: "Vehicle condition is recorded at pickup and return." },
] as const;

/**
 * Front door for sign-in, sign-up and identity verification: a split screen
 * on desktop, a single column on phones.
 *
 * The full marketing navbar (search, browse links) is deliberately left out.
 * Someone mid password-less login shouldn't be one tap away from wandering
 * off into the listings, so the only way out of this screen is the logo
 * (home) or finishing the form. `/verify-identity` carries its own sign-out
 * link inside the card for the one person who needs an exit here.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Form column: logo top, form vertically centred in the space
          between the logo and the footer line, so it sits in the same
          spot whether it's a one-field identifier stage or a longer
          signup form. */}
      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2 lg:px-14 lg:py-10 xl:w-[46%] xl:px-20">
        <Link href="/" className="inline-flex w-fit">
          <Image
            src="/logo-horizontal.png"
            alt="DriveLink"
            width={1034}
            height={175}
            unoptimized
            priority
            className="h-7 w-auto"
          />
        </Link>

        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <footer className="flex items-center justify-center gap-4 text-xs text-slate-500 lg:justify-start">
          <Link href="/terms" className="hover:text-slate-700">Terms</Link>
          <span aria-hidden="true" className="text-slate-300">{"·"}</span>
          <Link href="/privacy" className="hover:text-slate-700">Privacy</Link>
        </footer>
      </div>

      {/* Photo panel: desktop only. At phone width this would either crop
          the photo down to nothing recognisable or push the form below
          the fold, and the form is the one job of this screen. */}
      <div className="relative hidden shrink-0 p-4 lg:block lg:w-1/2 xl:w-[54%] xl:p-6">
        <div className="relative h-full w-full overflow-hidden rounded-3xl">
          <Image
            src="/destinations/ella.jpg"
            alt="Tea country near Ella, Sri Lanka"
            fill
            priority
            sizes="(min-width: 1280px) 54vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/92 via-navy-deep/25 to-navy/10" aria-hidden="true" />

          <div className="absolute inset-x-0 bottom-0 space-y-5 p-10 xl:p-12">
            {REASSURANCES.map(({ Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-inset ring-white/20">
                  <Icon size={16} className="text-white" aria-hidden="true" />
                </span>
                <p className="pt-1.5 text-sm font-medium leading-6 text-white/95">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
