import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "DriveLink SL — Car Rentals Sri Lanka",
    template: "%s | DriveLink SL",
  },
  description:
    "Find verified, affordable car rentals across Sri Lanka. ID-verified renters, trusted agencies.",
  keywords: ["car rental sri lanka", "rent a car colombo", "self drive sri lanka"],
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#fbf8f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Body bg + gradient lives in globals.css so the layered radial-
          gradients can be fixed-attached. Just set text colour here. */}
      <body className={`${geist.className} text-slate-200 antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
