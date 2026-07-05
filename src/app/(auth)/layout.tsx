import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/Navbar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Branded front-door header */}
          <Link href="/" className="flex flex-col items-center gap-2 mb-6">
            <Image src="/logo-circle.png" alt="DriveLink logo" width={56} height={56} priority unoptimized className="h-14 w-14" />
            <span className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase">
              Sri Lanka&apos;s verified vehicle marketplace
            </span>
          </Link>
          {children}
        </div>
      </div>
    </>
  );
}
