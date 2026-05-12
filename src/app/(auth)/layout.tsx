import { Navbar } from "@/components/layout/Navbar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </>
  );
}
