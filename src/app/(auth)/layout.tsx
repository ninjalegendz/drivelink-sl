import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <Link href="/" className="font-bold text-white text-2xl mb-8 tracking-tight">
        Drive<span className="text-amber-400">Link</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
