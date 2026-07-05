"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Car, KeyRound, User, Building2 } from "lucide-react";

type Step = "role" | "provider";

function ChoiceCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="spring-press group w-full text-left bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:border-blue-500 hover:shadow-md transition-all"
    >
      <span className="shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="block text-slate-500 text-sm mt-0.5">{subtitle}</span>
      </span>
      <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
    </button>
  );
}

function SignupChooser() {
  const router = useRouter();
  const params = useSearchParams();

  // "List your vehicle" CTAs deep-link straight to the provider sub-choice.
  // Initialise from the URL synchronously so there's no flash of the role step.
  const wantsProvider = params.get("intent") === "provider" || params.get("role") === "agency";
  const [step, setStep] = useState<Step>(wantsProvider ? "provider" : "role");

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      {step === "role" && (
        <>
          <h1 className="text-slate-900 font-bold text-xl mb-1">Join DriveLink</h1>
          <p className="text-slate-600 text-sm mb-6">What brings you here?</p>

          <div className="space-y-3">
            <ChoiceCard
              icon={<Car size={22} />}
              title="I'm a renter"
              subtitle="I'm looking to rent a vehicle"
              onClick={() => router.push("/signup/renter")}
            />
            <ChoiceCard
              icon={<KeyRound size={22} />}
              title="I'm an agent"
              subtitle="I'm looking to rent out my vehicles"
              onClick={() => setStep("provider")}
            />
          </div>

          <p className="text-slate-500 text-xs text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">Sign in</Link>
          </p>
        </>
      )}

      {step === "provider" && (
        <>
          <button
            type="button"
            onClick={() => setStep("role")}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs mb-4"
          >
            <ArrowLeft size={12} /> Back
          </button>

          <h1 className="text-slate-900 font-bold text-xl mb-1">List your vehicles</h1>
          <p className="text-slate-600 text-sm mb-6">Which describes you best?</p>

          <div className="space-y-3">
            <ChoiceCard
              icon={<User size={22} />}
              title="I'm an individual"
              subtitle="Renting out my own vehicle, or a few"
              onClick={() => router.push("/signup/agency?type=individual")}
            />
            <ChoiceCard
              icon={<Building2 size={22} />}
              title="I have a registered agency"
              subtitle="A rental business with a fleet"
              onClick={() => router.push("/signup/agency?type=agency")}
            />
          </div>

          <p className="text-slate-500 text-xs text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">Sign in</Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupChooser />
    </Suspense>
  );
}
