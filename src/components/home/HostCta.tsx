import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

/** Listing is free forever, so "free" is stated plainly, with no hedge. */
export function HostCta({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="bg-brand-gradient relative overflow-hidden rounded-3xl px-6 py-10 text-white sm:px-10 sm:py-14">
      <div className="relative z-10 max-w-xl space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">List your vehicle for free</h2>
        <p className="text-sm leading-relaxed text-white/80 sm:text-base">
          Create a Rental Page, add your vehicles, and start receiving requests. Listing on DriveLink costs nothing.
        </p>
        <Link
          href={signedIn ? "/account/pages/new" : "/signup?intent=provider"}
          className={buttonClasses({ variant: "secondary", size: "lg", className: "gap-2" })}
        >
          List your vehicle <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
