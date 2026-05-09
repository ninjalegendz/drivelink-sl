import { Navbar } from "@/components/layout/Navbar";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-950 text-white">{children}</main>
    </>
  );
}
