import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/Navbar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-10">
        {/* Slightly wider than before: the type scale grew, and a 24rem column
            made the longer explanations wrap into ragged three-word lines. */}
        <div className="w-full max-w-md">
          {/* Branded front-door header */}
          <Link href="/" className="mb-6 flex flex-col items-center gap-2">
            <Image src="/logo-circle.png" alt="DriveLink logo" width={56} height={56} priority unoptimized className="h-14 w-14" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sri Lanka&apos;s vehicle rental marketplace
            </span>
          </Link>
          {children}
        </div>
      </div>
    </>
  );
}
